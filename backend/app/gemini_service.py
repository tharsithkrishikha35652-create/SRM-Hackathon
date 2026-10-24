"""
Gemini AI Analysis Service for MessMate
Uses Google's `google-genai` SDK with fast Gemini Flash models.
Ensures zero latency impact on student actions by running strictly in background tasks.
Provides robust fallback to deterministic rule-based analysis if API is absent or unavailable.
"""

import os
import json
import re
import threading
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Ensure environment variables are loaded
_base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_base_dir, ".env"))

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None

# Thread-safe lock to prevent duplicate concurrent AI analysis runs
_analysis_lock = threading.Lock()
_is_analyzing = False

def get_gemini_config():
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest").strip()
    return api_key, model

def is_ai_enabled() -> bool:
    api_key, _ = get_gemini_config()
    return bool(api_key and genai is not None)

def get_ai_status(pending_count: int = 0) -> Dict[str, Any]:
    api_key, model = get_gemini_config()
    return {
        "enabled": bool(api_key and genai is not None),
        "is_analyzing": _is_analyzing,
        "pending_count": pending_count,
        "model": model if api_key else "deterministic-fallback",
        "provider": "google-genai" if (api_key and genai is not None) else "rule-based",
    }

def normalise_rule_based(text: str):
    t = text.lower()
    if any(w in t for w in ["cold", "not warm", "temperature"]):
        return "food_temperature", "Food was served cold", "Several students reported that the meal was not served at a suitable temperature."
    if any(w in t for w in ["salt", "salty"]):
        return "too_salty", "Food was too salty", "Feedback indicates that the seasoning may have been too strong."
    if any(w in t for w in ["hard", "dry", "softness"]):
        return "texture", "Food texture needs attention", "Students reported concerns about the texture or softness of the food."
    if any(w in t for w in ["hygiene", "clean", "hair", "unclean", "fly", "insect"]):
        return "hygiene", "Hygiene concern", "A hygiene-related concern was submitted and should be reviewed promptly."
    if any(w in t for w in ["quantity", "portion", "less food"]):
        return "portion_size", "Portion size concern", "Feedback suggests that serving quantity may need review."
    slug = re.sub(r"[^a-z0-9]+", "_", t).strip("_")[:48] or "general_feedback"
    title = (text.strip().capitalize()[:72] or "General food feedback")
    return slug, title, "A recurring student concern was reported. Review the submitted feedback pattern and decide on an appropriate action."

def call_gemini_grouping(complaints: List[Dict[str, Any]]) -> Optional[List[Dict[str, Any]]]:
    """
    Calls Google Gemini Flash to group complaints into issues.
    Never sends student identities, emails, or personal data.
    """
    api_key, model_name = get_gemini_config()
    if not api_key or genai is None:
        return None

    client = genai.Client(api_key=api_key)
    
    # Strip any potential PII - send only id, category, title, description
    payload_data = [
        {
            "id": c["id"],
            "meal_id": c["meal_id"],
            "category": c.get("category", "General"),
            "title": c.get("title", ""),
            "description": c.get("description", "")
        }
        for c in complaints
    ]

    prompt = (
        "You are an expert college mess feedback intelligence analyst. "
        "Analyze the following student complaints for a campus dining hall and group them into actionable issue themes.\n"
        "Strict rules:\n"
        "1. Do not invent facts, complaints, or counts.\n"
        "2. Only assign valid complaint IDs from the input list to complaint_ids.\n"
        "3. Keep student identities anonymous; focus purely on the food/service problem.\n"
        "4. Return a JSON array of grouped issues matching this schema:\n"
        "[\n"
        "  {\n"
        "    \"issue_key\": \"short_snake_case_key\",\n"
        "    \"title\": \"Clear concise issue title (max 70 chars)\",\n"
        "    \"summary\": \"One to two sentence summary of the aggregated problem (max 200 chars)\",\n"
        "    \"complaint_ids\": [1, 2]\n"
        "  }\n"
        "]\n\n"
        f"Input complaints:\n{json.dumps(payload_data)}"
    )

    models_to_try = [model_name] + [m for m in ["gemini-flash-lite-latest", "gemini-3.5-flash-lite"] if m != model_name]
    for candidate in models_to_try:
        try:
            response = client.models.generate_content(
                model=candidate,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=1000,
                ),
            )
            text = response.text or ""
            match = re.search(r"\[.*\]", text, re.DOTALL)
            if match:
                parsed = json.loads(match.group(0))
                if isinstance(parsed, list) and len(parsed) > 0:
                    print(f"[GeminiService] Successfully clustered {len(complaints)} complaints using {candidate}")
                    return parsed
        except Exception as e:
            # Try next candidate model
            print(f"[GeminiService] AI grouping attempt with {candidate} failed: {e}")
            continue
    return None

def process_pending_complaints_job(connect_fn, meal_info_dict, tz):
    """
    Background job triggered on new complaint submission or on demand.
    Ensures non-blocking execution, idempotent operations, and deterministic fallback.
    """
    global _is_analyzing
    if not _analysis_lock.acquire(blocking=False):
        # Job already running in background, avoid duplicate concurrent runs
        return

    _is_analyzing = True
    try:
        with connect_fn() as c:
            # Fetch unanalyzed or recent complaints
            unprocessed = c.execute(
                "SELECT id, meal_id, service_date, category, title, description FROM complaints WHERE processed_for_ai=0 ORDER BY id ASC LIMIT 50"
            ).fetchall()
            
            if not unprocessed:
                return

            complaints_list = [dict(row) for row in unprocessed]
            
            # Group complaints by (meal_id, service_date) for coherent analysis
            by_period = {}
            for comp in complaints_list:
                key = (comp["meal_id"], comp["service_date"])
                by_period.setdefault(key, []).append(comp)

            for (meal_id, service_date), comp_batch in by_period.items():
                gemini_result = call_gemini_grouping(comp_batch) if is_ai_enabled() else None
                
                if gemini_result:
                    # Apply Gemini grouping
                    for g in gemini_result:
                        key = g.get("issue_key", "general_issue")[:48]
                        title = str(g.get("title", "Food Feedback"))[:100]
                        summary = str(g.get("summary", ""))[:300]
                        c_ids = [cid for cid in g.get("complaint_ids", []) if any(x["id"] == cid for x in comp_batch)]
                        if not c_ids:
                            continue
                        
                        existing = c.execute(
                            "SELECT id, count FROM issue_groups WHERE meal_id=? AND service_date=? AND issue_key=?",
                            (meal_id, service_date, key)
                        ).fetchone()
                        
                        m_end = meal_info_dict.get(meal_id, {}).get("end", "22:00")
                        deadline = datetime.combine(date.fromisoformat(service_date), datetime.strptime(m_end, "%H:%M").time(), tz) + timedelta(hours=24)
                        
                        if existing:
                            gid = existing["id"]
                            c.execute(
                                "UPDATE issue_groups SET count=count+?, title=?, summary=?, deadline=? WHERE id=?",
                                (len(c_ids), title, summary, deadline.isoformat(), gid)
                            )
                        else:
                            cur = c.execute(
                                "INSERT INTO issue_groups(meal_id,service_date,issue_key,title,summary,count,deadline) VALUES(?,?,?,?,?,?,?)",
                                (meal_id, service_date, key, title, summary, len(c_ids), deadline.isoformat())
                            )
                            gid = cur.lastrowid
                        
                        for cid in c_ids:
                            c.execute("INSERT OR REPLACE INTO complaint_group_links(complaint_id,group_id) VALUES(?,?)", (cid, gid))
                            c.execute("UPDATE complaints SET processed_for_ai=1 WHERE id=?", (cid,))
                else:
                    # Fallback to deterministic rule-based grouping
                    for comp in comp_batch:
                        key, title, summary = normalise_rule_based(comp["category"] + " " + comp["title"] + " " + comp["description"])
                        existing = c.execute(
                            "SELECT id FROM issue_groups WHERE meal_id=? AND service_date=? AND issue_key=?",
                            (meal_id, service_date, key)
                        ).fetchone()
                        m_end = meal_info_dict.get(meal_id, {}).get("end", "22:00")
                        deadline = datetime.combine(date.fromisoformat(service_date), datetime.strptime(m_end, "%H:%M").time(), tz) + timedelta(hours=24)
                        
                        if existing:
                            gid = existing["id"]
                            c.execute("UPDATE issue_groups SET count=count+1, deadline=? WHERE id=?", (deadline.isoformat(), gid))
                        else:
                            cur = c.execute(
                                "INSERT INTO issue_groups(meal_id,service_date,issue_key,title,summary,count,deadline) VALUES(?,?,?,?,?,?,?)",
                                (meal_id, service_date, key, title, summary, 1, deadline.isoformat())
                            )
                            gid = cur.lastrowid
                        c.execute("INSERT OR REPLACE INTO complaint_group_links(complaint_id,group_id) VALUES(?,?)", (comp["id"], gid))
                        c.execute("UPDATE complaints SET processed_for_ai=1 WHERE id=?", (comp["id"],))
            c.commit()
    except Exception as e:
        print(f"[GeminiService] Error during background job: {e}")
    finally:
        _is_analyzing = False
        _analysis_lock.release()
