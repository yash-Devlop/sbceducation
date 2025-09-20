import pytz
import random
import string
from datetime import datetime

def generate_emp_id(role: str) -> str:
    role_prefix = {
        "manager": "M",
        "field-manager": "FM",
        "home-teacher": "HT"
    }

    if role not in role_prefix:
        raise ValueError(f"Unknown role: {role}")

    rand_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=7))

    return f"{role_prefix[role]}-{rand_str}"

def get_today_datetime_sql_format():
    kolkata_tz = pytz.timezone("Asia/Kolkata")
    now_kolkata = datetime.now(kolkata_tz)

    return now_kolkata.strftime("%Y-%m-%d %H:%M:%S")