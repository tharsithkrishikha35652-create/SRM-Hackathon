"""
Official CEG Campus, Anna University, Chennai - 25 Mess Menus
Engineering College Hostels (Valid 15-09-2026 to 31-01-2027)
Contains both Vegetarian and Non-Vegetarian weekly menus across all 7 days and 4 meal periods.
"""

from typing import Dict, List, Any

# Days of the week in order (0 = Monday, ..., 6 = Sunday)
WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

OFFICIAL_MENUS: Dict[str, Dict[str, Dict[str, List[str]]]] = {
    "non_veg": {
        "monday": {
            "breakfast": ["Sweet Pongal", "Pongal", "Methuvadai", "Sambar", "Coconut chutney", "Tea / Coffee / Milk"],
            "lunch": ["Rice", "Vatha Kuzhambu", "Keerai Kootu", "Rasam", "Buttermilk", "Vadagam", "Pickle", "Gulabjamun"],
            "snacks": ["Tea Cake", "Tea / Coffee / Milk"],
            "dinner": ["Onion Uthappam", "Sambar", "Paruppu Chutney / Mint Chutney", "Boost"],
        },
        "tuesday": {
            "breakfast": ["Samba Rava Kitchadi", "Idiyappam", "Coconut Milk", "Veg kurma", "Boiled Egg", "Tea / Coffee / Milk"],
            "lunch": ["Rice", "Sambar", "Beetroot Poriyal", "Rasam", "Buttermilk", "Botti Appalam", "Pickle"],
            "snacks": ["Butter Biscuit", "Tea / Coffee / Milk"],
            "dinner": ["Chapathi", "Chenna masala / Veg Kurma", "Curd Rice", "Lemon Juice"],
        },
        "wednesday": {
            "breakfast": ["Semiya Kitchadi", "Coconut Chutney", "Bread", "Jam", "Tea / Coffee / Milk"],
            "lunch": ["Rice", "Chicken Gravy / Fish kulambu", "Fish Fry", "Chicken Gravy", "Rasam", "Curd", "Nannari Sarbath"],
            "snacks": ["Keerai Vadai", "Tea / Coffee / Milk"],
            "dinner": ["Idly", "Sambar", "Coconut Chutney", "Podi", "Oil", "Badam Milk"],
        },
        "thursday": {
            "breakfast": ["Kal Dosai", "Sambar", "Groundnut Chutney", "Tea / Coffee / Milk"],
            "lunch": ["Rice", "Egg Kulambu", "Boiled Egg", "Cabbage Poriyal", "Vadagam", "Rasam", "Buttermilk", "Pickle"],
            "snacks": ["White Chenna / Black Chenna", "Tea / Coffee / Milk"],
            "dinner": ["Chapathi", "Mushroom Gravy / Paneer Butter Masala", "Curd Rice", "Lemon Juice"],
        },
        "friday": {
            "breakfast": ["Idly", "Sambar / Tomato Kurma", "Coconut Chutney", "Idly Podi", "Oil", "Fruit Kesari", "Tea / Coffee / Milk"],
            "lunch": ["Rice", "Dhall", "Potato Peas Poriyal", "Podi", "Oil", "Ghee", "Rasam", "Curd", "Appalam Poo", "Pickle", "Semiya Payasam / Dhall Payasam"],
            "snacks": ["Pani Poori", "Tea / Coffee / Milk"],
            "dinner": ["Veg Pulao", "Chicken Gravy", "Onion Raita", "Nannari Sarbath"],
        },
        "saturday": {
            "breakfast": ["Poori", "Chenna Masala", "Coconut chutney", "Tea / Coffee / Milk"],
            "lunch": ["Rice", "Sambar", "Yam Poriyal", "Vadagam", "Rasam", "Buttermilk", "Pickle"],
            "snacks": ["Groundnut", "Tea / Coffee / Milk"],
            "dinner": ["Dosai", "Potato Masala", "Kara chutney / Paruppu Chutney / Mint Chutney", "Milk"],
        },
        "sunday": {
            "breakfast": ["Bread Omelet", "Bread Toast", "Rava Kitchadi", "Kurma", "Jam", "Butter", "Tomato Sauce", "Chilli Sauce", "Tea / Coffee / Milk"],
            "lunch": ["Chicken Biriyani", "Chicken-65", "Chicken Kurma", "Onion raita", "Rice", "Rasam", "Dairy Day ice cream (Flavours) / (4th week) Mutton Biriyani, Arun Ice cream"],
            "snacks": ["Goodday Biscuit", "Tea / Coffee / Milk"],
            "dinner": ["Lemon Rice", "Curd Rice", "Paruppu Thuvaiyal", "Vadagam", "Pickle", "Red Banana / Morris Banana"],
        },
    },
    "veg": {
        "monday": {
            "breakfast": ["Sweet Pongal", "Pongal", "Methuvadai", "Sambar", "Coconut chutney", "Tea / Coffee / Milk"],
            "lunch": ["Rice", "Vatha Kuzhambu", "Keerai Kootu", "Rasam", "Buttermilk", "Vadagam", "Pickle", "Gulabjamun"],
            "snacks": ["Tea Cake", "Tea / Coffee / Milk"],
            "dinner": ["Onion Uthappam", "Sambar", "Paruppu Chutney / Mint Chutney", "Boost"],
        },
        "tuesday": {
            "breakfast": ["Samba Rava Kitchadi", "Idiyappam", "Coconut Milk", "Veg kurma", "Tea / Coffee / Milk"],
            "lunch": ["Rice", "Sambar", "Beetroot Poriyal", "Rasam", "Buttermilk", "Botti Appalam", "Pickle"],
            "snacks": ["Butter Biscuit", "Tea / Coffee / Milk"],
            "dinner": ["Chapathi", "Chenna masala / Veg Kurma", "Curd Rice", "Lemon Juice"],
        },
        "wednesday": {
            "breakfast": ["Semiya Kitchadi", "Coconut Chutney", "Bread", "Jam", "Tea / Coffee / Milk"],
            "lunch": ["Ghee Rice", "Gobi Manchuriyan / Mushroom Gravy / Paneer Gravy", "Rice", "Rasam", "Curd", "Nannari Sarbath"],
            "snacks": ["Keerai Vadai", "Tea / Coffee / Milk"],
            "dinner": ["Idly", "Sambar", "Coconut Chutney", "Podi", "Oil", "Badam milk"],
        },
        "thursday": {
            "breakfast": ["Kal Dosai", "Sambar", "Groundnut Chutney", "Tea / Coffee / Milk"],
            "lunch": ["Rice", "Sambar", "Cabbage Poriyal", "Vadagam", "Rasam", "Buttermilk", "Pickle", "Banana"],
            "snacks": ["White Chenna / Black Chenna", "Tea / Coffee / Milk"],
            "dinner": ["Chapathi", "Mushroom Gravy / Paneer Butter Masala", "Curd Rice", "Lemon Juice"],
        },
        "friday": {
            "breakfast": ["Idly", "Sambar / Tomato Kurma", "Coconut Chutney", "Idly Podi", "Oil", "Fruit Kesari", "Tea / Coffee / Milk"],
            "lunch": ["Rice", "Dhall", "Potato Peas Poriyal", "Podi", "Oil", "Ghee", "Rasam", "Curd", "Round Appalam", "Pickle", "Semiya Payasam / Dhall Payasam"],
            "snacks": ["Pani Poori", "Tea / Coffee / Milk"],
            "dinner": ["Veg Pulao", "Gobi Machuriyan", "Onion Raita", "Nannari Sarbath"],
        },
        "saturday": {
            "breakfast": ["Poori", "Chenna Masala", "Coconut chutney", "Tea / Coffee / Milk"],
            "lunch": ["Rice", "Sambar", "Yam Poriyal", "Vadagam", "Rasam", "Buttermilk", "Pickle"],
            "snacks": ["Groundnut", "Tea / Coffee / Milk"],
            "dinner": ["Dosai", "Potato Masala", "Kara chutney / Paruppu Chutney / Mint Chutney", "Milk"],
        },
        "sunday": {
            "breakfast": ["Bread Toast", "Rava Kitchadi", "Kurma", "Jam", "Butter", "Tomato Sauce", "Chilli Sauce", "Tea / Coffee / Milk"],
            "lunch": ["Veg Pulao / Veg Biriyani", "Saivai Dish / Gobi-65 / Paneer Manchariayan", "Onion raita", "Rice", "Rasam", "Dairy Day ice cream (Flavours) / Arun ice cream (4th week)"],
            "snacks": ["Goodday Biscuit", "Tea / Coffee / Milk"],
            "dinner": ["Lemon Rice", "Curd Rice", "Paruppu Thuvaiyal", "Vadagam", "Pickle", "Red Banana / Morris Banana"],
        },
    },
}

def get_official_menu(day_name: str, meal_id: str, dietary: str = "non_veg") -> List[str]:
    d = (dietary or "non_veg").lower().replace("-", "_").replace(" ", "_")
    if d not in OFFICIAL_MENUS:
        d = "non_veg"
    day = day_name.lower().strip()
    return OFFICIAL_MENUS[d].get(day, {}).get(meal_id.lower().strip(), [])
