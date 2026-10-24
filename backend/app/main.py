from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date, time, timedelta
from zoneinfo import ZoneInfo
import sqlite3, os, secrets, hashlib, hmac, json, re, urllib.request

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "messmate.db")
TZ = ZoneInfo(os.getenv("APP_TIMEZONE", "Asia/Kolkata"))
app = FastAPI(title="MessMate API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

MEALS = [
    {"id":"breakfast","name":"Breakfast","start":"07:00","end":"11:00","time":"7:00 AM – 11:00 AM"},
    {"id":"lunch","name":"Lunch","start":"12:30","end":"15:00","time":"12:30 PM – 3:00 PM"},
    {"id":"snacks","name":"Snacks","start":"16:00","end":"18:00","time":"4:00 PM – 6:00 PM"},
    {"id":"dinner","name":"Dinner","start":"19:00","end":"22:00","time":"7:00 PM – 10:00 PM"},
]
MENUS = {
 "breakfast":["Idli","Sambar","Coconut chutney","Pongal","Tea"],
 "lunch":["Rice","Sambar","Rasam","Chicken curry / vegetable kurma","Cabbage poriyal","Curd"],
 "snacks":["Tea / Coffee","Sundal","Seasonal snack"],
 "dinner":["Chapati","Paneer gravy / chicken curry","Dal","Curd","Pickle"]
}

def connect():
    c=sqlite3.connect(DB_PATH, timeout=10); c.row_factory=sqlite3.Row; c.execute("PRAGMA foreign_keys=ON"); return c

def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 180000).hex()
    return f"{salt}${hashed}"

def check_password(password, stored):
    try:
        salt, expected = stored.split("$",1)
        actual=hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 180000).hex()
        return hmac.compare_digest(actual, expected)
    except Exception: return False

def init_db():
    with connect() as c:
        c.executescript('''
        CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, identifier TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('student','manager')), password_hash TEXT NOT NULL, register_no TEXT, department TEXT, semester TEXT, theme TEXT DEFAULT 'light');
        CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), meal_id TEXT NOT NULL, service_date TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), items_json TEXT NOT NULL DEFAULT '{}', comment TEXT DEFAULT '', category TEXT DEFAULT '', created_at TEXT NOT NULL, UNIQUE(user_id, meal_id, service_date));
        CREATE TABLE IF NOT EXISTS complaints(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), meal_id TEXT NOT NULL, service_date TEXT NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Submitted', created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS issue_groups(id INTEGER PRIMARY KEY, meal_id TEXT NOT NULL, service_date TEXT NOT NULL, issue_key TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'Open', response TEXT DEFAULT '', responded_at TEXT, deadline TEXT NOT NULL, UNIQUE(meal_id, service_date, issue_key));
        CREATE TABLE IF NOT EXISTS complaint_group_links(complaint_id INTEGER PRIMARY KEY REFERENCES complaints(id) ON DELETE CASCADE, group_id INTEGER NOT NULL REFERENCES issue_groups(id) ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS menu_items(id INTEGER PRIMARY KEY, menu_date TEXT NOT NULL, meal_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT DEFAULT '', dietary_type TEXT NOT NULL DEFAULT 'Veg');
        ''')
        if c.execute("SELECT COUNT(*) n FROM users").fetchone()["n"] == 0:
            c.execute("INSERT INTO users(identifier,name,role,password_hash,register_no,department,semester) VALUES(?,?,?,?,?,?,?)",("student@srm.edu","Vatsan Kumar","student",hash_password("Student@123"),"RA2311003010001","Computer Science","Semester 1"))
            c.execute("INSERT INTO users(identifier,name,role,password_hash) VALUES(?,?,?,?)",("manager@srm.edu","Mess Manager","manager",hash_password("Manager@123")))
        if c.execute("SELECT COUNT(*) n FROM menu_items").fetchone()["n"] == 0:
            today_menu_date=datetime.now(TZ).date()
            for offset in range(7):
                menu_date=(today_menu_date+timedelta(days=offset)).isoformat()
                for meal_id, names in MENUS.items():
                    for item_name in names:
                        dtype='Non-Veg' if any(word in item_name.lower() for word in ['chicken']) else 'Veg'
                        c.execute("INSERT INTO menu_items(menu_date,meal_id,name,description,dietary_type) VALUES(?,?,?,?,?)",(menu_date,meal_id,item_name,'Daily mess menu item',dtype))
        if c.execute("SELECT COUNT(*) n FROM complaints").fetchone()["n"] == 0:
            today=datetime.now(TZ).date().isoformat(); now=datetime.now(TZ)
            seed=[("lunch","Food Quality","Chicken curry was too salty","The curry was very salty and difficult to eat."),("lunch","Food Temperature","Lunch was served cold","The rice and curry were cold when served."),("lunch","Food Temperature","Food was cold","Rice was not warm enough."),("lunch","Food Quality","Too much salt in curry","The curry tasted excessively salty."),("dinner","Taste","Chapati was hard","The chapati was hard and dry.")]
            for i,(meal,cat,title,desc) in enumerate(seed):
                c.execute("INSERT INTO complaints(user_id,meal_id,service_date,category,title,description,status,created_at) VALUES(?,?,?,?,?,?,?,?)",(1,meal,today,cat,title,desc,"Submitted",now.isoformat()))
        c.commit()
init_db()

class LoginBody(BaseModel): identifier: str; password: str; role: str
class FeedbackBody(BaseModel): meal_id: str; service_date: str; rating: int = Field(ge=1,le=5); items: dict = {}; comment: str = ""; category: str = ""
class ComplaintBody(BaseModel): meal_id: str; service_date: str; category: str; title: str; description: str
class ResponseBody(BaseModel): response: str
class ThemeBody(BaseModel): theme: str
class MenuItemBody(BaseModel): menu_date: str; meal_id: str; name: str = Field(min_length=1,max_length=120); description: str = ''; dietary_type: str = 'Veg'; id: Optional[int] = None

def current_user(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "): raise HTTPException(401,"Please sign in to continue")
    token=authorization.split(" ",1)[1]
    with connect() as c:
        row=c.execute("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?",(token,datetime.now(TZ).isoformat())).fetchone()
    if not row: raise HTTPException(401,"Your session has expired. Please sign in again.")
    return dict(row)

def require_role(role):
    def dependency(user=Depends(current_user)):
        if user["role"] != role: raise HTTPException(403,"You do not have permission to access this page")
        return user
    return dependency

def active_meal(now=None):
    now=now or datetime.now(TZ)
    hm=now.strftime("%H:%M")
    for m in MEALS:
        if m["start"] <= hm < m["end"]: return m
    return None

def meal_by_id(meal_id):
    m=next((x for x in MEALS if x["id"]==meal_id),None)
    if not m: raise HTTPException(400,"Unknown meal")
    return m

def menu_names_for_date(menu_date, meal_id):
    with connect() as c:
        rows=c.execute("SELECT name FROM menu_items WHERE menu_date=? AND meal_id=? ORDER BY id",(menu_date,meal_id)).fetchall()
    return [row["name"] for row in rows] or MENUS.get(meal_id, [])

def ensure_window(meal_id):
    meal=meal_by_id(meal_id); hm=datetime.now(TZ).strftime("%H:%M")
    if not (meal["start"] <= hm < meal["end"]): raise HTTPException(403,f"{meal['name']} feedback is open {meal['time']} only.")

def normalise_issue(text):
    t=text.lower()
    if any(w in t for w in ["cold","not warm","temperature"]): return "food_temperature", "Food was served cold", "Several students reported that the meal was not served at a suitable temperature."
    if any(w in t for w in ["salt","salty"]): return "too_salty", "Food was too salty", "Feedback indicates that the seasoning may have been too strong."
    if any(w in t for w in ["hard","dry","softness"]): return "texture", "Food texture needs attention", "Students reported concerns about the texture or softness of the food."
    if any(w in t for w in ["hygiene","clean","hair","unclean"]): return "hygiene", "Hygiene concern", "A hygiene-related concern was submitted and should be reviewed promptly."
    if any(w in t for w in ["quantity","portion","less food"]): return "portion_size", "Portion size concern", "Feedback suggests that serving quantity may need review."
    slug=re.sub(r"[^a-z0-9]+","_",t).strip("_")[:48] or "general_feedback"
    title=(text.strip().capitalize()[:72] or "General food feedback")
    return slug,title,"A recurring student concern was reported. Review the submitted feedback pattern and decide on an appropriate action."

def rebuild_groups(meal_id, service_date):
    with connect() as c:
        rows=c.execute("SELECT * FROM complaints WHERE meal_id=? AND service_date=?",(meal_id,service_date)).fetchall()
        groups={}
        for row in rows:
            key,title,summary=normalise_issue(row["category"]+" "+row["title"]+" "+row["description"])
            groups.setdefault(key,{"title":title,"summary":summary,"ids":[]})["ids"].append(row["id"])
        for key,g in groups.items():
            existing=c.execute("SELECT id,response,status FROM issue_groups WHERE meal_id=? AND service_date=? AND issue_key=?",(meal_id,service_date,key)).fetchone()
            deadline=datetime.combine(date.fromisoformat(service_date),time.fromisoformat(meal_by_id(meal_id)["end"]),TZ)+timedelta(hours=24)
            if existing:
                gid=existing["id"]; c.execute("UPDATE issue_groups SET count=?,title=?,summary=?,deadline=? WHERE id=?",(len(g["ids"]),g["title"],g["summary"],deadline.isoformat(),gid))
            else:
                cur=c.execute("INSERT INTO issue_groups(meal_id,service_date,issue_key,title,summary,count,deadline) VALUES(?,?,?,?,?,?,?)",(meal_id,service_date,key,g["title"],g["summary"],len(g["ids"]),deadline.isoformat())); gid=cur.lastrowid
            for cid in g["ids"]: c.execute("INSERT OR REPLACE INTO complaint_group_links(complaint_id,group_id) VALUES(?,?)",(cid,gid))
        c.commit()

# Build initial manager issue groups from seeded complaint data on startup.
with connect() as _seed_conn:
    _seed_pairs = _seed_conn.execute("SELECT DISTINCT meal_id, service_date FROM complaints").fetchall()
for _pair in _seed_pairs:
    rebuild_groups(_pair["meal_id"], _pair["service_date"])

def maybe_llm_summary(title, summary, count):
    key=os.getenv("LLM_API_KEY","").strip()
    if not key: return title, summary, "rule-based"
    # Optional OpenAI-compatible summarisation; send only the pre-aggregated, sanitised issue, never raw submissions.
    try:
        url=os.getenv("LLM_BASE_URL","https://api.openai.com/v1").rstrip("/")+"/chat/completions"
        payload={"model":os.getenv("LLM_MODEL","gpt-4o-mini"),"temperature":0.2,"messages":[{"role":"system","content":"Write concise, non-identifying mess issue summaries. Return JSON only with title and summary. Do not invent facts."},{"role":"user","content":json.dumps({"issue_title":title,"sanitised_pattern":summary,"verified_report_count":count})}]}
        req=urllib.request.Request(url,data=json.dumps(payload).encode(),headers={"Authorization":"Bearer "+key,"Content-Type":"application/json"},method="POST")
        with urllib.request.urlopen(req,timeout=8) as res: data=json.loads(res.read().decode())
        content=data["choices"][0]["message"]["content"]; match=re.search(r"\{.*\}",content,re.S)
        if match:
            parsed=json.loads(match.group(0)); return str(parsed.get("title",title))[:100],str(parsed.get("summary",summary))[:500],"llm"
    except Exception: pass
    return title,summary,"rule-based"

@app.get("/api/health")
def health(): return {"status":"ok","app":"MessMate","database":"sqlite","time":datetime.now(TZ).isoformat()}

@app.post("/api/auth/login")
def login(body: LoginBody):
    with connect() as c: row=c.execute("SELECT * FROM users WHERE lower(identifier)=lower(?) OR lower(register_no)=lower(?)",(body.identifier.strip(),body.identifier.strip())).fetchone()
    if not row or not check_password(body.password,row["password_hash"]): raise HTTPException(401,"Invalid login details")
    if row["role"] != body.role: raise HTTPException(403,"This account belongs to a different login type. Choose the correct login.")
    token=secrets.token_urlsafe(36); expiry=(datetime.now(TZ)+timedelta(days=7)).isoformat()
    with connect() as c: c.execute("INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)",(token,row["id"],expiry)); c.commit()
    return {"token":token,"expires_at":expiry,"user":{"id":row["id"],"name":row["name"],"role":row["role"],"identifier":row["identifier"],"register_no":row["register_no"],"department":row["department"],"semester":row["semester"],"theme":row["theme"]}}

@app.get("/api/auth/me")
def me(user=Depends(current_user)):
    return {k:user.get(k) for k in ["id","name","role","identifier","register_no","department","semester","theme"]}

@app.post("/api/auth/logout")
def logout(authorization: Optional[str]=Header(default=None), user=Depends(current_user)):
    token=authorization.split(" ",1)[1]
    with connect() as c: c.execute("DELETE FROM sessions WHERE token=?",(token,)); c.commit()
    return {"ok":True}

@app.put("/api/profile/theme")
def set_theme(body: ThemeBody,user=Depends(current_user)):
    if body.theme not in ("light","dark"): raise HTTPException(400,"Theme must be light or dark")
    with connect() as c: c.execute("UPDATE users SET theme=? WHERE id=?",(body.theme,user["id"])); c.commit()
    return {"theme":body.theme}

@app.get("/api/menu/today")
def today_menu(user=Depends(current_user)):
    now=datetime.now(TZ); active=active_meal(now)
    meals=[{**m,"items":menu_names_for_date(now.date().isoformat(),m["id"]),"status":"open" if active and active["id"]==m["id"] else ("upcoming" if now.strftime("%H:%M")<m["start"] else "closed")} for m in MEALS]
    return {"date":now.date().isoformat(),"date_label":now.strftime("%a, %d %b %Y"),"active_meal":active["id"] if active else None,"meals":meals}

@app.get("/api/menu/complete")
def complete_menu(user=Depends(current_user)):
    today=datetime.now(TZ).date()
    return {"days":[{"date":(today+timedelta(days=i)).isoformat(),"label":(today+timedelta(days=i)).strftime("%A, %d %b"),"meals":[{**m,"items":menu_names_for_date((today+timedelta(days=i)).isoformat(),m["id"])} for m in MEALS]} for i in range(7)]}

@app.get("/api/feedback/mine")
def my_feedback(user=Depends(require_role("student"))):
    with connect() as c:
        f=c.execute("SELECT * FROM feedback WHERE user_id=? ORDER BY created_at DESC",(user["id"],)).fetchall()
        co=c.execute("SELECT c.*,g.status AS group_status,g.response FROM complaints c LEFT JOIN complaint_group_links l ON l.complaint_id=c.id LEFT JOIN issue_groups g ON g.id=l.group_id WHERE c.user_id=? ORDER BY c.created_at DESC",(user["id"],)).fetchall()
    return {"ratings":[{**dict(x),"items":json.loads(x["items_json"])} for x in f],"complaints":[dict(x) for x in co]}

@app.post("/api/feedback")
def submit_feedback(body: FeedbackBody,user=Depends(require_role("student"))):
    ensure_window(body.meal_id); meal_by_id(body.meal_id)
    with connect() as c:
        try:
            c.execute("INSERT INTO feedback(user_id,meal_id,service_date,rating,items_json,comment,category,created_at) VALUES(?,?,?,?,?,?,?,?)",(user["id"],body.meal_id,body.service_date,body.rating,json.dumps(body.items),body.comment[:1000],body.category[:80],datetime.now(TZ).isoformat())); c.commit()
        except sqlite3.IntegrityError: raise HTTPException(409,"You've already rated this meal today.")
    return {"ok":True,"message":"Thanks — your feedback has been submitted."}

@app.post("/api/complaints")
def submit_complaint(body: ComplaintBody,user=Depends(require_role("student"))):
    ensure_window(body.meal_id)
    if len(body.title.strip())<3 or len(body.description.strip())<5: raise HTTPException(422,"Please add a title and a little more detail.")
    now=datetime.now(TZ); service_date=body.service_date
    with connect() as c:
        cur=c.execute("INSERT INTO complaints(user_id,meal_id,service_date,category,title,description,created_at) VALUES(?,?,?,?,?,?,?)",(user["id"],body.meal_id,service_date,body.category[:80],body.title.strip()[:120],body.description.strip()[:1500],now.isoformat())); c.commit(); cid=cur.lastrowid
    rebuild_groups(body.meal_id,service_date)
    return {"ok":True,"id":cid,"message":"Your complaint has been submitted privately."}

@app.get("/api/manager/menu")
def manager_menu(menu_date: str, user=Depends(require_role("manager"))):
    try: date.fromisoformat(menu_date)
    except ValueError: raise HTTPException(400,"Use YYYY-MM-DD for the menu date")
    with connect() as c:
        rows=c.execute("SELECT * FROM menu_items WHERE menu_date=? ORDER BY CASE meal_id WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 WHEN 'snacks' THEN 3 ELSE 4 END, id",(menu_date,)).fetchall()
        if not rows:
            for meal_id, names in MENUS.items():
                for item_name in names:
                    dtype='Non-Veg' if 'chicken' in item_name.lower() else 'Veg'
                    c.execute("INSERT INTO menu_items(menu_date,meal_id,name,description,dietary_type) VALUES(?,?,?,?,?)",(menu_date,meal_id,item_name,'Daily mess menu item',dtype))
            c.commit()
            rows=c.execute("SELECT * FROM menu_items WHERE menu_date=? ORDER BY CASE meal_id WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 WHEN 'snacks' THEN 3 ELSE 4 END, id",(menu_date,)).fetchall()
    return {"date":menu_date,"items":[dict(r) for r in rows]}

@app.post("/api/manager/menu")
def save_manager_menu(body: MenuItemBody, user=Depends(require_role("manager"))):
    try: date.fromisoformat(body.menu_date)
    except ValueError: raise HTTPException(400,"Use YYYY-MM-DD for the menu date")
    meal_by_id(body.meal_id)
    if body.dietary_type not in ("Veg","Non-Veg","Vegan"): raise HTTPException(400,"Invalid food type")
    name=body.name.strip()
    if not name: raise HTTPException(422,"Item name is required")
    with connect() as c:
        if body.id:
            exists=c.execute("SELECT id FROM menu_items WHERE id=?",(body.id,)).fetchone()
            if not exists: raise HTTPException(404,"Menu item not found")
            c.execute("UPDATE menu_items SET menu_date=?,meal_id=?,name=?,description=?,dietary_type=? WHERE id=?",(body.menu_date,body.meal_id,name,body.description[:250],body.dietary_type,body.id)); item_id=body.id
        else:
            cur=c.execute("INSERT INTO menu_items(menu_date,meal_id,name,description,dietary_type) VALUES(?,?,?,?,?)",(body.menu_date,body.meal_id,name,body.description[:250],body.dietary_type)); item_id=cur.lastrowid
        c.commit(); row=c.execute("SELECT * FROM menu_items WHERE id=?",(item_id,)).fetchone()
    return dict(row)

@app.delete("/api/manager/menu/{item_id}")
def delete_manager_menu(item_id: int, user=Depends(require_role("manager"))):
    with connect() as c:
        cur=c.execute("DELETE FROM menu_items WHERE id=?",(item_id,)); c.commit()
    if cur.rowcount==0: raise HTTPException(404,"Menu item not found")
    return {"ok":True}

@app.get("/api/manager/feedback")
def manager_feedback(user=Depends(require_role("manager"))):
    # Return anonymised aggregate issue groups and meal ratings; never expose individual identifiers or raw complaint text.
    with connect() as c:
        groups=c.execute("SELECT * FROM issue_groups ORDER BY service_date DESC, count DESC").fetchall()
        ratings=c.execute("SELECT meal_id,service_date,AVG(rating) average,COUNT(*) count,category FROM feedback GROUP BY meal_id,service_date,category ORDER BY service_date DESC").fetchall()
        total_complaints=c.execute("SELECT COUNT(*) n FROM complaints").fetchone()["n"]
        total_ratings=c.execute("SELECT COUNT(*) n FROM feedback").fetchone()["n"]
    items=[]
    for row in groups:
        d=dict(row); d.update({"type":"Complaint","category":"Grouped issue","title":d["title"],"summary":d["summary"]}); items.append(d)
    for row in ratings:
        d=dict(row); items.append({"id":f"rating-{d['meal_id']}-{d['service_date']}-{len(items)}","type":"Rating","meal_id":d["meal_id"],"service_date":d["service_date"],"category":d["category"] or "Meal rating","title":f"Average rating {round(d['average'],1)}/5","summary":"Aggregated meal-rating responses for this meal and category; individual comments are not shown.","rating":round(d["average"],1),"count":d["count"],"status":"Recorded"})
    return {"counts":{"all":len(items),"complaints":len(groups),"ratings":len(ratings),"total_complaints":total_complaints,"total_ratings":total_ratings},"items":items}

@app.get("/api/manager/overview")
def manager_overview(user=Depends(require_role("manager"))):
    today=datetime.now(TZ).date().isoformat()
    with connect() as c:
        ratings=c.execute("SELECT meal_id,AVG(rating) avg,COUNT(*) count FROM feedback WHERE service_date=? GROUP BY meal_id",(today,)).fetchall()
        total=c.execute("SELECT COUNT(*) n FROM complaints WHERE service_date=?",(today,)).fetchone()["n"]
        issues=c.execute("SELECT * FROM issue_groups ORDER BY CASE status WHEN 'Open' THEN 0 ELSE 1 END, count DESC, deadline ASC LIMIT 100").fetchall()
        rating_total=c.execute("SELECT COUNT(*) n FROM feedback WHERE service_date=?",(today,)).fetchone()["n"]
    meal_ratings={r["meal_id"]:{"average":round(r["avg"],1),"count":r["count"]} for r in ratings}
    out=[]
    for row in issues:
        d=dict(row); d["overdue"]=d["status"]!="Responded" and datetime.now(TZ)>datetime.fromisoformat(d["deadline"])
        d["title"],d["summary"],d["summary_source"]=maybe_llm_summary(d["title"],d["summary"],d["count"]); out.append(d)
    return {"date":today,"total_complaints":total,"total_ratings":rating_total,"meal_ratings":meal_ratings,"issues":out,"summary_mode":"llm" if os.getenv("LLM_API_KEY") else "rule-based"}

@app.post("/api/manager/issues/{issue_id}/respond")
def respond(issue_id:int,body:ResponseBody,user=Depends(require_role("manager"))):
    response=body.response.strip()
    if len(response)<3: raise HTTPException(422,"Please enter a response.")
    now=datetime.now(TZ).isoformat()
    with connect() as c:
        row=c.execute("SELECT id,deadline FROM issue_groups WHERE id=?",(issue_id,)).fetchone()
        if not row: raise HTTPException(404,"Issue not found")
        c.execute("UPDATE issue_groups SET response=?,responded_at=?,status='Responded' WHERE id=?",(response[:1500],now,issue_id))
        c.execute("UPDATE complaints SET status='Responded' WHERE id IN (SELECT complaint_id FROM complaint_group_links WHERE group_id=?)",(issue_id,)); c.commit()
    return {"ok":True,"responded_at":now,"on_time":datetime.fromisoformat(now)<=datetime.fromisoformat(row["deadline"])}
