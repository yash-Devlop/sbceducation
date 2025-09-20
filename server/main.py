from fastapi import FastAPI, HTTPException, status, Security, Depends
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import os
import random
import string
import pytz
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pathlib import Path
from contextlib import asynccontextmanager
from jose import jwt, JWTError, ExpiredSignatureError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from utils.db_config import get_db_connection, initialize_db
from utils.api_error import raise_http_error
from utils.scheduler import add_funds_daily, add_salary_hometeacher
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from pydantic_models.models import Admin_login_request, emp_login_request, create_emp_request, Add_funds_request, HistoryRequest
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = os.getenv("ALGORITHM")
TOKEN_EXPIRE_DAYS = int(os.getenv("TOKEN_EXPIRE_DAYS"))

#=================LOGIN FUNCTIONS========================

security = HTTPBearer()

async def get_login_role(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        role = payload.get("role")
        print(f"role: {role}")

        if role not in ["admin", "manager", "field-manager", "home-teacher"]:
            print("except")
            raise HTTPException(
                
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have enough permissions"
            )
        return payload

    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )
#=========================================================

#==================ALLOWED HIREARCHIES===================
allowed_hierarchy = {
    "admin": ["manager", "field-manager", "home-teacher"],
    "manager": ["field-manager"],
    "field-manager": ["home-teacher"],
    "home-teacher": []
}

#=========================================================

#===================HELPER FUNCTIONS=======================
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
#===============================================================

scheduler = BackgroundScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[INFO]:  Starting up: Initialize resources")
    await asyncio.to_thread(initialize_db)

    scheduler.add_job(
        func=lambda: add_funds_daily(50),
        trigger=CronTrigger(hour=4, minute=0, timezone=ZoneInfo("Asia/Kolkata")),
        id="salary_job",
        replace_existing=True
    )
    scheduler.add_job(
        func=lambda: add_salary_hometeacher(4950),
        trigger=CronTrigger(hour=4, minute=30, timezone=ZoneInfo("Asia/Kolkata")),
        id="salary_job",
        replace_existing=True
    )
    scheduler.start()
    
    try:
        yield

    finally:
        print("[INFO]:  Shutting down: Clean up resources")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return "Server running"

@app.post("/admin_login")
async def admin_login(data: Admin_login_request):
    try:
        file_path = Path(__file__).parent / "credentials.txt"
        with open(file_path, "r") as file:
            credentials = file.readlines()

        for line in credentials:
            stored_id, stored_password = line.strip().split(":")

        expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
        
        if data.username == stored_id and data.pwd == stored_password:
            payload = {
                "role": "admin",
                "emp_id": "admin",
                "exp": expire
            }

            token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

            return {
                "status": "good",
                "matches": "login-successfull",
                "access_token": token,
                "token_type": "bearer",
                "role": "admin"
            }

        return {"status": "bad", "matches": "invalid-credentials"}

    except FileNotFoundError:
        raise_http_error("Credentials file not found")
    except Exception as err:
        raise_http_error("Cannot validate credentials", err)


@app.post("/emp_login")
async def emp_login(data: emp_login_request):
    if data.role not in ["manager", "field-manager", "home-teacher"]:
        raise_http_error("Wrong role selected")

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT id, name FROM employees WHERE email = %s AND password = %s AND role = %s",
            (data.email, data.pwd, data.role)
        )

        row = cursor.fetchone()
        if not row:
            return {"status": "bad", "matches": "invalid-credentials"}

        emp_id, emp_name = row

        expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)

        payload = {
            "role": data.role,
            "emp_id": emp_id,
            "exp": expire
        }

        token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

        return {
            "status": "good",
            "matches": "login-successful",
            "access_token": token,
            "token_type": "bearer",
            "emp_name": emp_name,
            "role": data.role
        }

    except Exception as err:
        raise_http_error("Cannot validate credentials", err)
    finally:
        conn.close()

@app.post("/create_employee")
async def create_employee(data: create_emp_request, token_data: dict = Depends(get_login_role)):
    creator_role = token_data.get("role")
    creator_id = token_data.get("emp_id")

    print(f"creator_role: {creator_role}")
    print(f"creator_id: {creator_id}")

    if creator_role not in allowed_hierarchy:
        raise HTTPException(status_code=403, detail=f"{creator_role} cannot create any employees")

    if data.role not in allowed_hierarchy[creator_role]:
        raise HTTPException(status_code=403, detail=f"{creator_role} cannot create {data.role}")

    manager_id = None if data.role == "manager" else creator_id

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        new_emp_id = generate_emp_id(data.role)
        today_datetime = get_today_datetime_sql_format()
        cursor.execute(
            """
            INSERT INTO employees (id, name, fname, mname, DOB, addr, city, district, state, email, phn, password, role, manager_id, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (new_emp_id, data.name, data.fname, data.mname, data.dob, data.addr, data.city, data.district, data.state, data.email, data.phn, data.pwd, data.role, manager_id, today_datetime)
        )

        funds_to_add = 0
        if creator_role == "manager" and data.role == "field-manager":
            funds_to_add = 50
        elif creator_role == "field-manager" and data.role == "home-teacher":
            funds_to_add = 150

        if funds_to_add > 0:
            cursor.execute(
                "UPDATE employees SET funds = IFNULL(funds,0) + %s WHERE id = %s",
                (funds_to_add, creator_id)
            )

        conn.commit()
        return {"status": "good", "detail": {"message": f"{data.role} created successfully"}}

    except Exception as err:
        conn.rollback()
        raise raise_http_error("Cannot create employee", err)

    finally:
        conn.close()


@app.post("/add_funds")
async def add_funds(data: Add_funds_request, token_data: dict = Depends(get_login_role)):
    sender_id = token_data.get("emp_id")
    sender_role = token_data.get("role")

    if data.amount <= 0:
        raise HTTPException(status_code=400, detail={"message": "Amount must be greater than 0"})

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # ✅ Check receiver exists
        cursor.execute("SELECT role, manager_id FROM employees WHERE id = %s", (data.receiver_id,))
        receiver = cursor.fetchone()
        if not receiver:
            raise HTTPException(status_code=404, detail={"message": "Receiver not found"})
        receiver_role, receiver_manager_id = receiver

        # ✅ Handle non-admin senders
        if sender_role != "admin":
            cursor.execute("SELECT role, funds FROM employees WHERE id = %s", (sender_id,))
            sender = cursor.fetchone()
            if not sender:
                raise HTTPException(status_code=404, detail={"message": "Sender not found"})
            db_sender_role, sender_funds = sender
            sender_funds = sender_funds or 0

            if sender_funds < data.amount:
                raise HTTPException(status_code=400, detail={"message": "Insufficient funds"})

        # ✅ Role-based transfer rules
        if sender_role == "admin":
            # admin can fund anyone, no checks needed
            pass
        elif sender_role == "manager":
            if receiver_manager_id != sender_id or receiver_role != "field-manager":
                raise HTTPException(status_code=403, detail={"message": "Manager can only fund their own field-managers"})
        elif sender_role == "field-manager":
            if receiver_manager_id != sender_id or receiver_role != "home-teacher":
                raise HTTPException(status_code=403, detail={"message": "Field-manager can only fund their own home-teachers"})
        else:
            raise HTTPException(status_code=403, detail={"message": f"{sender_role} cannot transfer funds"})

        # ✅ Deduct from sender (only if not admin)
        if sender_role != "admin":
            cursor.execute(
                "UPDATE employees SET funds = funds - %s WHERE id = %s",
                (data.amount, sender_id)
            )

        # ✅ Add to receiver
        cursor.execute(
            "UPDATE employees SET funds = funds + %s WHERE id = %s",
            (data.amount, data.receiver_id)
        )

        # ✅ Log transfer history
        today_datetime = get_today_datetime_sql_format()
        cursor.execute(
            """
            INSERT INTO funds_transfer_history (sender_id, transferred_amount, reciever_id, transferred_at)
            VALUES (%s, %s, %s, %s)
            """,
            (
                None if sender_role == "admin" else sender_id,  # allow NULL for admin
                data.amount,
                data.receiver_id,
                today_datetime
            )
        )

        conn.commit()
        return {
            "status": "good",
            "detail": {"message": f"{data.amount} transferred to {data.receiver_id}"}
        }

    except HTTPException:
        raise
    except Exception as err:
        conn.rollback()
        raise raise_http_error("cannot add funds", err)
    finally:
        conn.close()



@app.post("/funds_transfer_history")
async def funds_transfer_history(data: HistoryRequest, token_data: dict = Depends(get_login_role)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        emp_id = token_data.get("emp_id")
        role = token_data.get("role")

        today = datetime.today().date()
        start_date = data.start_date
        end_date = data.end_date

        # ----------------------
        # 🔹 Handle date logic
        # ----------------------
        if role != "admin":
            if start_date and not end_date:
                # if only start_date → end_date = min(start+2 months, today)
                max_end = start_date + timedelta(days=60)
                end_date = min(max_end, today)

            elif start_date and end_date:
                # validate range ≤ 2 months
                if (end_date - start_date).days > 62:  # allow ~2 months
                    raise HTTPException(
                        status_code=400,
                        detail={"message": "Date range cannot exceed 2 months"}
                    )
                # also disallow future
                if end_date > today:
                    end_date = today

            elif not start_date and not end_date:
                # default → last 10 days
                end_date = today
                start_date = today - timedelta(days=10)

        # For admin → no restriction
        where_clause = ""
        params = []
        if role == "admin":
            if start_date and end_date:
                where_clause = "WHERE DATE(f.transferred_at) BETWEEN %s AND %s"
                params = [start_date, end_date]
        else:
            where_clause = "WHERE (f.sender_id = %s OR f.reciever_id = %s)"
            params = [emp_id, emp_id]
            if start_date and end_date:
                where_clause += " AND DATE(f.transferred_at) BETWEEN %s AND %s"
                params.extend([start_date, end_date])

        # ----------------------
        # 🔹 Queries
        # ----------------------
        query = f"""
            SELECT 
                f.id,
                f.sender_id,
                COALESCE(s.name, 'Admin') AS sender_name,
                f.reciever_id,
                r.name AS reciever_name,
                f.transferred_amount,
                f.transferred_at
            FROM funds_transfer_history f
            LEFT JOIN employees s ON f.sender_id = s.id
            JOIN employees r ON f.reciever_id = r.id
            {where_clause}
            ORDER BY f.transferred_at DESC
        """

        if role != "admin":
            query += " LIMIT 30"

        cursor.execute(query, tuple(params))
        history = cursor.fetchall()

        return {"transactions": history}

    except HTTPException:
        raise
    except Exception as err:
        raise raise_http_error("cannot fetch transfer history", err)
    finally:
        conn.close()


@app.get("/get_emp_funds")
async def get_emp_funds(token_data: dict = Depends(get_login_role)):
    emp_id = token_data.get("emp_id")
    if emp_id == "admin":
        raise_http_error("cannot get funds for admin")

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT funds FROM employees WHERE id = %s", (emp_id,))

        amount = cursor.fetchone()
        if not amount:
            raise_http_error("cannot find employee")
        return {"status": "good", "detail": {"message": "Funds fetched succesully", "funds": amount[0]}}
    except Exception as err:
        raise_http_error("cannot get employee funds", err)
    finally:
        conn.close()

@app.get("/get_emp_details/{emp_id}")
async def get_emp_details(emp_id: str, token_data: dict = Depends(get_login_role)):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT name, fname, mname, DOB, addr, city, district, state, email, phn, role, manager_id FROM employees WHERE id = %s", (emp_id,))
        
        row = cursor.fetchone()
        if not row:
            return {"status": "bad", "detail": {"message": "employee not found"}}

        emp_detail = {
            "name": row[0],
            "fname": row[1],
            "mname": row[2],
            "DOB": row[3],
            "addr": row[4],
            "city": row[5],
            "district": row[6],
            "state": row[7],
            "email": row[8],
            "phn": row[9],
            "role": row[10],
            "manager_id": row[11],
        }

        return {"status": "good", "detail": {"message": "Employee details found", "data": emp_detail}}

    except Exception as err:
        raise_http_error("cannot get employees details", err)
    finally:
        conn.close()

@app.get("/get_all_employees")
async def get_all_employees(token_data: dict = Depends(get_login_role)):
    role = token_data.get("role")
    emp_id = token_data.get("emp_id")
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        if role == "admin":
            # Admin can see all employees
            cursor.execute("""
                SELECT e.id, e.name, e.email, e.role, e.funds, e.created_at,
                       m.name as manager_name
                FROM employees e
                LEFT JOIN employees m ON e.manager_id = m.id
                ORDER BY 
                    CASE e.role 
                        WHEN 'manager' THEN 1
                        WHEN 'field-manager' THEN 2 
                        WHEN 'home-teacher' THEN 3
                    END,
                    e.created_at DESC
            """)
        
        elif role == "manager":
            # Manager can see only their direct field-managers + those FM’s home-teachers
            cursor.execute("""
                SELECT e.id, e.name, e.email, e.role, e.funds, e.created_at,
                       m.name as manager_name
                FROM employees e
                LEFT JOIN employees m ON e.manager_id = m.id
                WHERE e.manager_id = %s 
                   OR e.manager_id IN (
                       SELECT id FROM employees WHERE manager_id = %s AND role = 'field-manager'
                   )
                ORDER BY 
                    CASE e.role 
                        WHEN 'field-manager' THEN 1
                        WHEN 'home-teacher' THEN 2
                    END,
                    e.created_at DESC
            """, (emp_id, emp_id))

        elif role == "field-manager":
            # Field-manager can see only their direct home-teachers
            cursor.execute("""
                SELECT e.id, e.name, e.email, e.role, e.funds, e.created_at,
                       m.name as manager_name
                FROM employees e
                LEFT JOIN employees m ON e.manager_id = m.id
                WHERE e.manager_id = %s AND e.role = 'home-teacher'
                ORDER BY e.created_at DESC
            """, (emp_id,))
        
        else:
            return {"status": "error", "message": "Insufficient permissions"}
        
        employees = cursor.fetchall()
        return {"status": "success", "employees": employees}
    
    except Exception as err:
        raise_http_error("Cannot fetch employees", err)
    finally:
        conn.close()


@app.get("/get_employee_hierarchy")
async def get_employee_hierarchy(token_data: dict = Depends(get_login_role)):
    role = token_data.get("role")
    
    if role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can access hierarchy")
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Get managers
        cursor.execute("""
            SELECT id, name, email, funds, created_at 
            FROM employees 
            WHERE role = 'manager' 
            ORDER BY created_at DESC
        """)
        managers = cursor.fetchall()
        
        hierarchy = []
        
        for manager in managers:
            # Get field-managers under this manager
            cursor.execute("""
                SELECT id, name, email, funds, created_at 
                FROM employees 
                WHERE role = 'field-manager' AND manager_id = %s
                ORDER BY created_at DESC
            """, (manager['id'],))
            field_managers = cursor.fetchall()
            
            # For each field-manager, get their home-teachers
            for fm in field_managers:
                cursor.execute("""
                    SELECT id, name, email, funds, created_at 
                    FROM employees 
                    WHERE role = 'home-teacher' AND manager_id = %s
                    ORDER BY created_at DESC
                """, (fm['id'],))
                fm['home_teachers'] = cursor.fetchall()
            
            manager['field_managers'] = field_managers
            hierarchy.append(manager)
        
        return {"status": "success", "hierarchy": hierarchy}
    
    except Exception as err:
        raise_http_error("Cannot fetch hierarchy", err)
    finally:
        conn.close()

@app.get("/get_dashboard_stats")
async def get_dashboard_stats(token_data: dict = Depends(get_login_role)):
    role = token_data.get("role")
    
    if role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can access dashboard stats")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Count employees by role
        cursor.execute("SELECT role, COUNT(*) as count FROM employees GROUP BY role")
        role_counts = dict(cursor.fetchall())
        
        # Total funds distributed
        cursor.execute("SELECT SUM(funds) as total_funds FROM employees WHERE funds > 0")
        total_funds = cursor.fetchone()[0] or 0
        
        # Recent transfers (last 10)
        cursor.execute("""
            SELECT f.transferred_amount, f.transferred_at, 
                   s.name as sender_name, r.name as receiver_name
            FROM funds_transfer_history f
            JOIN employees s ON f.sender_id = s.id  
            JOIN employees r ON f.reciever_id = r.id
            ORDER BY f.transferred_at DESC LIMIT 10
        """)
        recent_transfers = cursor.fetchall()
        
        return {
            "status": "success",
            "stats": {
                "total_managers": role_counts.get('manager', 0),
                "total_field_managers": role_counts.get('field-manager', 0), 
                "total_home_teachers": role_counts.get('home-teacher', 0),
                "total_funds_distributed": total_funds,
                "recent_transfers": recent_transfers
            }
        }
    
    except Exception as err:
        raise_http_error("Cannot fetch dashboard stats", err)
    finally:
        conn.close()
