from fastapi import FastAPI, HTTPException, status, Security, Depends
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pathlib import Path
from contextlib import asynccontextmanager
from jose import jwt, JWTError, ExpiredSignatureError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from utils.db_config import get_db_connection, initialize_db
from utils.api_error import raise_http_error
from utils.helper import generate_emp_id, get_role_from_emp_id, get_today_datetime_sql_format
from pydantic_models.models import Admin_login_request, HomeTeacherSalaryInfo, SalarySlipRequest, emp_login_request, create_emp_request, create_manager_request, Add_funds_request, HistoryRequest, User_querry_request
from datetime import datetime, timezone, timedelta

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

        if role not in ["admin", "manager", "field-manager", "home-teacher", "branch"]:
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

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[INFO]:  Starting up: Initialize resources")
    await asyncio.to_thread(initialize_db)
    
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
    if data.role not in ["manager", "field-manager", "home-teacher", "branch"]:
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
            return {"status": "bad", "matches": "Invalid credentials"}

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

    if creator_role != "manager":
        raise_http_error(f"Only manager can create {data.role}")
    if data.role not in ["field-manager", "home-teacher"]:
        raise_http_error("Invalid role provided")

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        new_emp_id = generate_emp_id(data.role)
        today_datetime = get_today_datetime_sql_format()

        cursor.execute("SELECT funds from employees where id = %s", (creator_id,))
        total_funds = cursor.fetchone()[0]

        if data.role == "field-manager":
            if total_funds < 950:
                return {"status": "bad", "detail": {"message": "Insufficient funds"}}
            cursor.execute(
                """
                INSERT INTO employees (id, name, fname, mname, DOB, addr, city, district, state, email, phn, password, role, manager_id, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (new_emp_id, data.name, data.fname, data.mname, data.dob, data.addr, data.city, data.district, data.state, data.email, data.phn, data.pwd, data.role, creator_id, today_datetime)
            )

            cursor.execute("UPDATE employees SET funds = funds - %s WHERE id = %s", (950, creator_id))

            cursor.execute(
                """
                INSERT INTO commisions (manager_id, manager_commision, created_role, created_id, registered_at)
                VALUES(%s, %s, %s, %s, %s)
                """, (creator_id, 50, data.role, new_emp_id, today_datetime)
            )
        
        if data.role == "home-teacher":
            if total_funds < 4950:
                return {"status": "bad", "detail": {"message": "Insufficient funds"}}
            cursor.execute(
                """
                INSERT INTO employees (id, name, fname, mname, DOB, addr, city, district, state, email, phn, password, role, manager_id, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (new_emp_id, data.name, data.fname, data.mname, data.dob, data.addr, data.city, data.district, data.state, data.email, data.phn, data.pwd, data.role, data.manager_id, today_datetime)
            )

            cursor.execute("UPDATE employees SET funds = funds - %s WHERE id = %s", (4950, creator_id))

            cursor.execute(
                """
                INSERT INTO commisions (manager_id, field_manager_id, manager_commision, field_manager_commision, created_role, created_id, registered_at)
                VALUES(%s, %s, %s, %s, %s, %s, %s)
                """, (creator_id, data.manager_id, 50, 150, data.role, new_emp_id, today_datetime)
            )

        conn.commit()
        return {"status": "good", "detail": {"message": f"{data.role} created successfully", "role": data.role, "name": data.name, "email": data.email, "password": data.pwd}}

    except Exception as err:
        conn.rollback()
        print(data)
        print(err)
        raise raise_http_error("Cannot create employee", err)

    finally:
        conn.close()

@app.post("/create_branch_emp")
async def create_branch_emp(data: create_emp_request, token_data: dict = Depends(get_login_role)):

    creator_role = token_data.get("role")

    if data.role != "branch" and creator_role != "admin":
        raise_http_error(f"Cannot create {data.role}.")

    conn = get_db_connection()
    cursor = conn.cursor()


    try:
        new_emp_id = generate_emp_id(data.role)
        today_datetime = get_today_datetime_sql_format()

        cursor.execute(
            """
            INSERT INTO employees (id, name, fname, mname, DOB, addr, city, district, state, email, phn, password, role, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (new_emp_id, data.name, data.fname, data.mname, data.dob, data.addr, data.city, data.district, data.state, data.email, data.phn, data.pwd, data.role, today_datetime)
        )
        conn.commit()

        return {"status": "good", "detail": {"message": "Branch employee created.", "role": data.role, "name": data.name, "email": data.email, "password": data.pwd}}

    except Exception as err:
        raise_http_error("Cannot create branch", err)
    finally:
        conn.close()

@app.post("/create_manager")
async def create_manager(data: create_manager_request, token_data: dict = Depends(get_login_role)):

    creater_role = token_data.get("role")

    if creater_role != "admin":
        raise_http_error("Only admin can make managers")

    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        new_emp_id = generate_emp_id("manager")
        today_datetime = get_today_datetime_sql_format()
        cursor.execute(
            """
            INSERT INTO employees (id, name, fname, mname, DOB, addr, city, district, state, email, phn, password, role, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (new_emp_id, data.name, data.fname, data.mname, data.dob, data.addr, data.city, data.district, data.state, data.email, data.phn, data.pwd, "manager", today_datetime)
        )
        conn.commit()
        return {"status": "good", "detail": {"message": "Manager created successfully"}}

    except Exception as err:
        conn.rollback()
        print(err)
        raise_http_error("Cannot create manager", err)
    finally:
        conn.close()


@app.post("/add_funds")
async def add_funds(data: Add_funds_request, token_data: dict = Depends(get_login_role)):
    sender_id = token_data.get("emp_id")
    sender_role = token_data.get("role")

    if sender_id != "admin" and sender_role != "admin":
        raise_http_error("Only admin can send funds")

    if data.amount <= 0:
        raise HTTPException(status_code=400, detail={"message": "Amount must be greater than 0"})

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT role, manager_id FROM employees WHERE id = %s", (data.receiver_id,))
        receiver = cursor.fetchone()
        if not receiver:
            raise HTTPException(status_code=404, detail={"message": "Receiver not found"})

        cursor.execute(
            "UPDATE employees SET funds = funds + %s WHERE id = %s",
            (data.amount, data.receiver_id)
        )

        today_datetime = get_today_datetime_sql_format()
        cursor.execute(
            """
            INSERT INTO funds_transfer_history (sender_id, transferred_amount, reciever_id, transferred_at)
            VALUES (%s, %s, %s, %s)
            """,
            (
                None,
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
        print(err)
        raise raise_http_error("cannot add funds", err)
    finally:
        conn.close()



@app.post("/funds_transfer_history")
async def funds_transfer_history_branch(data: HistoryRequest, token_data: dict = Depends(get_login_role)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        emp_id = token_data.get("emp_id")
        role = token_data.get("role")

        today = datetime.today().date()
        start_date = data.start_date
        end_date = data.end_date

        if not start_date and not end_date:
            end_date = today
            start_date = today - timedelta(days=30)

        elif start_date and not end_date:
            max_end = start_date + timedelta(days=60)
            end_date = min(max_end, today)

        elif start_date and end_date:
            if (end_date - start_date).days > 62:
                raise HTTPException(
                    status_code=400,
                    detail={"message": "Date range cannot exceed 2 months"}
                )
            # disallow future dates
            if end_date > today:
                end_date = today

        where_clause = ""
        params = []

        if role in ["admin", "branch"]:
            where_clause = "WHERE DATE(f.transferred_at) BETWEEN %s AND %s"
            params = [start_date, end_date]

        elif role == "manager":
            where_clause = """
                WHERE (f.sender_id = %s OR f.reciever_id = %s)
                AND DATE(f.transferred_at) BETWEEN %s AND %s
            """
            params = [emp_id, emp_id, start_date, end_date]

        else:
            return {
                "status": "bad", 
                "detail": {
                    "message": f"{role} cannot see transaction history.", 
                    "transactions": []
                }
            }

        query = f"""
            SELECT 
                f.id,
                f.sender_id,
                COALESCE(s.name, 'Admin') AS sender_name,
                f.reciever_id,
                r.name AS reciever_name,
                r.role AS reciever_role,
                f.transferred_amount,
                f.transferred_at
            FROM funds_transfer_history f
            LEFT JOIN employees s ON f.sender_id = s.id
            JOIN employees r ON f.reciever_id = r.id
            {where_clause}
            ORDER BY f.transferred_at DESC
        """

        cursor.execute(query, tuple(params))
        history = cursor.fetchall()

        return {"status": "good", "detail": {"transactions": history}}

    except HTTPException:
        raise
    except Exception as err:
        raise_http_error("Cannot fetch transfer history", err)
    finally:
        conn.close()



@app.get("/get_commisions/{emp_id}")
async def get_commisions(emp_id: str, token_data: dict = Depends(get_login_role)):
    user_role = token_data.get("role")
    user_id = token_data.get("emp_id")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)  # return rows as dicts

    try:
        # ADMIN or requesting own commissions
        if user_role == "admin" or user_role == "branch " or user_id == emp_id:
            cursor.execute(
                """
                SELECT * 
                FROM commisions 
                WHERE manager_id = %s OR field_manager_id = %s
                """,
                (emp_id, emp_id)
            )
            rows = cursor.fetchall()
            return {"status": "good", "detail": rows}

        # MANAGER
        elif user_role == "manager":
            cursor.execute(
                """
                SELECT * 
                FROM commisions 
                WHERE manager_id = %s
                """,
                (user_id,)
            )
            rows = cursor.fetchall()
            return {"status": "good", "detail": rows}

        # FIELD MANAGER
        elif user_role == "field-manager":
            cursor.execute(
                """
                SELECT * 
                FROM commisions 
                WHERE field_manager_id = %s
                """,
                (user_id,)
            )
            rows = cursor.fetchall()
            return {"status": "good", "detail": rows}

        else:
            return {"status": "bad", "detail": {"message": "You are not allowed to view commissions"}}

    except Exception as err:
        raise_http_error("Cannot get commission list", err)

    finally:
        conn.close()


            

@app.get("/get_emp_funds")
async def get_emp_funds(token_data: dict = Depends(get_login_role)):
    emp_id = token_data.get("emp_id")
    role = token_data.get("role")
    if role != "manager":
        raise_http_error(f"cannot get funds for {role}")

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT funds FROM employees WHERE id = %s", (emp_id,))

        amount = cursor.fetchone()
        if not amount:
            raise_http_error("Cannot find employee")
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
        if role in ["admin", "branch"]:
            # Branch and admin can see all employees except addresses
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
                        WHEN 'branch' THEN 4
                    END,
                    e.created_at DESC
            """)
        
        elif role == "manager":
            # Manager can see only their direct field-managers + those FM's home-teachers
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
    
    if role not in ["admin", "branch"]:
        raise HTTPException(status_code=403, detail="Only admin and branch can access hierarchy")
    
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
    
    if role not in ["admin", "branch"]:
        raise HTTPException(status_code=403, detail="Only admin and branch can access dashboard stats")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Count employees by role
        cursor.execute("SELECT role, COUNT(*) as count FROM employees GROUP BY role")
        role_counts = dict(cursor.fetchall())
        
        # Total funds distributed
        cursor.execute("SELECT SUM(funds) as total_funds FROM employees WHERE funds > 0")
        total_funds = cursor.fetchone()[0] or 0
        
        return {
            "status": "success",
            "stats": {
                "total_managers": role_counts.get('manager', 0),
                "total_field_managers": role_counts.get('field-manager', 0), 
                "total_home_teachers": role_counts.get('home-teacher', 0),
                "total_funds_distributed": total_funds
            }
        }
    
    except Exception as err:
        raise_http_error("Cannot fetch dashboard stats", err)
    finally:
        conn.close()


@app.post("/user_querry")
async def get_user_querry(data: User_querry_request):
    conn = get_db_connection()
    cursor = conn.cursor()

    try: 
        cursor.execute(
            "INSERT INTO user_querry (name, email, phn, querry) VALUES (%s, %s, %s, %s)",
            (data.name, data.email, data.phn, data.querry)
        )
        conn.commit()

        return {"status": "good", "detail" : {"message": "querry noted"}}

    except Exception as err:
        raise_http_error("Cannot take questions right now", err)
    finally:
        conn.close()


@app.get("/get_user_querries")
async def get_user_querries():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("select * from user_querry;")
        rows = cursor.fetchall()

        if not rows:
            return {"status": "bad", "detail": {"message": "No querries yet"}}

        data = [
            {
                "name": row[0],
                "email": row[1],
                "phn": row[2],
                "querry": row[3],
                "created_at": row[4]
            }
            for row in rows
        ]

        return {"status": "good", "detail": {"message": "user querries fetched", "data": data}}

    except Exception as err:
        raise_http_error("cannot get user querries", err)
    finally:
        conn.close()


# Add this new endpoint to your existing FastAPI application

@app.get("/get_field_managers_under_manager/{manager_id}")
async def get_field_managers_under_manager(manager_id: str, token_data: dict = Depends(get_login_role)):
    """
    Get all field managers under a specific manager
    Only the manager themselves or admin can access this data
    """
    user_role = token_data.get("role")
    user_id = token_data.get("emp_id")
    
    # Check authorization
    if user_role != "admin" and user_id != manager_id:
        raise HTTPException(
            status_code=403, 
            detail={"message": "You can only view your own field managers"}
        )
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Get all field managers under this manager
        cursor.execute("""
            SELECT id, name, email, funds, created_at
            FROM employees 
            WHERE role = 'field-manager' AND manager_id = %s
            ORDER BY created_at DESC
        """, (manager_id,))
        
        field_managers = cursor.fetchall()
        
        # Get count of home teachers under each field manager
        for fm in field_managers:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM employees 
                WHERE role = 'home-teacher' AND manager_id = %s
            """, (fm['id'],))
            
            count_result = cursor.fetchone()
            fm['home_teachers_count'] = count_result['count'] if count_result else 0
        
        return {
            "status": "success", 
            "field_managers": field_managers,
            "total_count": len(field_managers)
        }
        
    except Exception as err:
        raise_http_error("Cannot fetch field managers", err)
    finally:
        conn.close()


@app.get("/get_manager_monthly_commissions/{manager_id}/{year}/{month}")
async def get_manager_monthly_commissions(
    manager_id: str, 
    year: int, 
    month: int, 
    token_data: dict = Depends(get_login_role)
):
    """
    Get detailed commission breakdown for a manager for a specific month and year
    """
    user_role = token_data.get("role")
    user_id = token_data.get("emp_id")
    
    # Check authorization
    if user_role not in ["admin", "branch"] and user_id != manager_id:
        raise HTTPException(
            status_code=403, 
            detail={"message": "You can only view your own commission details"}
        )
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Get commissions for the specific month and year
        cursor.execute("""
            SELECT 
                c.*,
                e.name as created_employee_name
            FROM commisions c
            LEFT JOIN employees e ON c.created_id = e.id
            WHERE c.manager_id = %s 
            AND YEAR(c.registered_at) = %s 
            AND MONTH(c.registered_at) = %s
            ORDER BY c.registered_at DESC
        """, (manager_id, year, month))
        
        commissions = cursor.fetchall()
        
        # Calculate totals
        total_commission = sum(c['manager_commision'] or 0 for c in commissions)
        field_manager_count = len([c for c in commissions if c['created_role'] == 'field-manager'])
        home_teacher_count = len([c for c in commissions if c['created_role'] == 'home-teacher'])
        
        return {
            "status": "success",
            "month": month,
            "year": year,
            "commissions": commissions,
            "summary": {
                "total_commission": total_commission,
                "field_managers_recruited": field_manager_count,
                "home_teachers_recruited": home_teacher_count,
                "total_registrations": len(commissions)
            }
        }
        
    except Exception as err:
        raise_http_error("Cannot fetch monthly commissions", err)
    finally:
        conn.close()


@app.post("/get_manager_commission_history")
async def get_manager_commission_history(
    data: HistoryRequest,
    token_data: dict = Depends(get_login_role)
):
    """
    Get commission history for a manager with date filtering
    """
    user_role = token_data.get("role")
    user_id = token_data.get("emp_id")
    
    if user_role not in ["admin", "branch", "manager"]:
        raise HTTPException(
            status_code=403,
            detail={"message": "Insufficient permissions"}
        )
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        today = datetime.today().date()
        start_date = data.start_date
        end_date = data.end_date
        
        # Set default date range if not provided
        if not start_date and not end_date:
            end_date = today
            start_date = today - timedelta(days=90)  # Last 3 months
        elif start_date and not end_date:
            max_end = start_date + timedelta(days=90)
            end_date = min(max_end, today)
        elif start_date and end_date:
            if (end_date - start_date).days > 365:  # Max 1 year range
                raise HTTPException(
                    status_code=400,
                    detail={"message": "Date range cannot exceed 1 year"}
                )
            if end_date > today:
                end_date = today
        
        where_clause = ""
        params = []
        
        if user_role in ["admin", "branch"]:
            where_clause = "WHERE DATE(c.registered_at) BETWEEN %s AND %s"
            params = [start_date, end_date]
        else:  # manager
            where_clause = """
                WHERE c.manager_id = %s 
                AND DATE(c.registered_at) BETWEEN %s AND %s
            """
            params = [user_id, start_date, end_date]
        
        query = f"""
            SELECT 
                c.*,
                e.name as created_employee_name,
                m.name as manager_name
            FROM commisions c
            LEFT JOIN employees e ON c.created_id = e.id
            LEFT JOIN employees m ON c.manager_id = m.id
            {where_clause}
            ORDER BY c.registered_at DESC
        """
        
        cursor.execute(query, tuple(params))
        history = cursor.fetchall()
        
        # Calculate summary
        total_commission = sum(h['manager_commision'] or 0 for h in history)
        field_managers = len([h for h in history if h['created_role'] == 'field-manager'])
        home_teachers = len([h for h in history if h['created_role'] == 'home-teacher'])
        
        return {
            "status": "success",
            "commission_history": history,
            "summary": {
                "total_commission": total_commission,
                "field_managers_recruited": field_managers,
                "home_teachers_recruited": home_teachers,
                "total_registrations": len(history),
                "date_range": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as err:
        raise_http_error("Cannot fetch commission history", err)
    finally:
        conn.close()


# Add this endpoint to your FastAPI controller

@app.get("/get_field_manager_data/{field_manager_id}")
async def get_field_manager_data(field_manager_id: str, token_data: dict = Depends(get_login_role)):
    """
    Get field manager's home teachers and commission data
    """
    user_role = token_data.get("role")
    user_id = token_data.get("emp_id")
    
    # Check authorization
    if user_role != "field-manager" or user_id != field_manager_id:
        if user_role not in ["admin", "manager"]:
            raise HTTPException(
                status_code=403, 
                detail={"message": "Unauthorized access"}
            )
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Get home teachers under this field manager
        cursor.execute("""
            SELECT id, name, email, phn, city, state, created_at
            FROM employees 
            WHERE role = 'home-teacher' AND manager_id = %s
            ORDER BY created_at DESC
        """, (field_manager_id,))
        
        home_teachers = cursor.fetchall()
        
        # Get field manager's commissions
        cursor.execute("""
            SELECT c.*, e.name as created_employee_name
            FROM commisions c
            LEFT JOIN employees e ON c.created_id = e.id
            WHERE c.field_manager_id = %s
            ORDER BY c.registered_at DESC
        """, (field_manager_id,))
        
        commissions = cursor.fetchall()
        
        # Get field manager's own details
        cursor.execute("""
            SELECT e.name, e.email, e.manager_id, m.name as manager_name
            FROM employees e
            LEFT JOIN employees m ON e.manager_id = m.id
            WHERE e.id = %s
        """, (field_manager_id,))
        
        field_manager_info = cursor.fetchone()
        
        # Calculate stats
        total_home_teachers = len(home_teachers)
        total_commission = sum(c['field_manager_commision'] or 0 for c in commissions)
        
        return {
            "status": "success",
            "data": {
                "field_manager_info": field_manager_info,
                "home_teachers": home_teachers,
                "commissions": commissions,
                "stats": {
                    "total_home_teachers": total_home_teachers,
                    "total_commission": total_commission
                }
            }
        }
        
    except Exception as err:
        raise_http_error("Cannot fetch field manager data", err)
    finally:
        conn.close()


@app.get("/get_field_manager_monthly_commissions/{field_manager_id}/{year}/{month}")
async def get_field_manager_monthly_commissions(
    field_manager_id: str, 
    year: int, 
    month: int, 
    token_data: dict = Depends(get_login_role)
):
    """
    Get field manager's commission breakdown for a specific month
    """
    user_role = token_data.get("role")
    user_id = token_data.get("emp_id")
    
    # Check authorization
    if user_role != "field-manager" or user_id != field_manager_id:
        if user_role not in ["admin", "manager"]:
            raise HTTPException(
                status_code=403, 
                detail={"message": "Unauthorized access"}
            )
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Get commissions for the specific month and year
        cursor.execute("""
            SELECT 
                c.*,
                e.name as created_employee_name
            FROM commisions c
            LEFT JOIN employees e ON c.created_id = e.id
            WHERE c.field_manager_id = %s 
            AND YEAR(c.registered_at) = %s 
            AND MONTH(c.registered_at) = %s
            ORDER BY c.registered_at DESC
        """, (field_manager_id, year, month))
        
        commissions = cursor.fetchall()
        
        # Calculate totals
        total_commission = sum(c['field_manager_commision'] or 0 for c in commissions)
        home_teacher_count = len([c for c in commissions if c['created_role'] == 'home-teacher'])
        
        return {
            "status": "success",
            "month": month,
            "year": year,
            "commissions": commissions,
            "summary": {
                "total_commission": total_commission,
                "home_teachers_recruited": home_teacher_count,
                "total_registrations": len(commissions)
            }
        }
        
    except Exception as err:
        raise_http_error("Cannot fetch monthly commissions", err)
    finally:
        conn.close()


@app.get("/get_home_teacher_funds")
async def get_home_teacher_funds(token_data: dict = Depends(get_login_role)):
    """
    Get home teacher funds (returns static 0 as home teachers don't handle funds)
    """
    emp_id = token_data.get("emp_id")
    role = token_data.get("role")
    
    if role != "home-teacher":
        raise_http_error(f"Cannot get funds for {role}")

    return {
        "status": "good", 
        "detail": {
            "message": "Funds fetched successfully", 
            "funds": 0
        }
    }

@app.post("/generate_salary_slip")
async def generate_salary_slip(
    data: SalarySlipRequest,
    token_data: dict = Depends(get_login_role)
):
    """
    Generate salary slip for home teacher
    """
    emp_id = token_data.get("emp_id")
    role = token_data.get("role")

    if role != "home-teacher":
        raise HTTPException(
            status_code=403,
            detail={"message": "Only home teachers can generate salary slips"}
        )

    # Validate month and year
    if not (1 <= data.month <= 12):
        raise HTTPException(
            status_code=400,
            detail={"message": "Invalid month. Must be between 1 and 12"}
        )

    current_year = datetime.now().year
    if not (current_year - 5 <= data.year <= current_year):
        raise HTTPException(
            status_code=400,
            detail={"message": f"Invalid year. Must be between {current_year - 5} and {current_year}"}
        )

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Get employee details
        cursor.execute(
            "SELECT name, email, created_at FROM employees WHERE id = %s",
            (emp_id,)
        )
        employee_data = cursor.fetchone()

        if not employee_data:
            raise HTTPException(
                status_code=404,
                detail={"message": "Employee not found"}
            )

        employee_name, employee_email, created_at = employee_data

        # Ensure created_at is a datetime object
        if isinstance(created_at, str):
            try:
                created_at = datetime.strptime(created_at, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                created_at = datetime.strptime(created_at, "%Y-%m-%d")

        # Check if requested month/year is before joining date
        requested_date = datetime(data.year, data.month, 1)
        if requested_date < created_at:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Salary slip cannot be created before joining date",
                    "joining_date": created_at.strftime("%Y-%m-%d"),
                    "requested_month": f"{data.month}/{data.year}"
                }
            )

        # Create salary slip data
        salary_info = HomeTeacherSalaryInfo(
            employee_id=emp_id,
            employee_name=employee_name
        )

        # Log salary slip generation
        today_datetime = get_today_datetime_sql_format()
        cursor.execute(
            """
            INSERT INTO salary_slip_history (employee_id, month, year, generated_at)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE generated_at = %s
            """,
            (emp_id, data.month, data.year, today_datetime, today_datetime)
        )
        conn.commit()

        return {
            "status": "success",
            "salary_slip": salary_info.dict(),
            "generation_date": datetime.now().isoformat(),
            "message": "Salary slip generated successfully"
        }

    except HTTPException:
        raise
    except Exception as err:
        conn.rollback()
        raise_http_error("Cannot generate salary slip", err)
    finally:
        conn.close()


@app.get("/get_salary_slip_history")
async def get_salary_slip_history(token_data: dict = Depends(get_login_role)):
    """
    Get salary slip generation history for home teacher
    """
    emp_id = token_data.get("emp_id")
    role = token_data.get("role")
    
    if role != "home-teacher":
        raise HTTPException(
            status_code=403,
            detail={"message": "Only home teachers can view salary slip history"}
        )
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute(
            """
            SELECT month, year, generated_at
            FROM salary_slip_history
            WHERE employee_id = %s
            ORDER BY year DESC, month DESC
            LIMIT 12
            """,
            (emp_id,)
        )
        
        history = cursor.fetchall()
        
        return {
            "status": "success",
            "history": history,
            "message": "Salary slip history retrieved successfully"
        }
        
    except Exception as err:
        raise_http_error("Cannot fetch salary slip history", err)
    finally:
        conn.close()

@app.get("/get_home_teacher_profile")
async def get_home_teacher_profile(token_data: dict = Depends(get_login_role)):
    """
    Get complete home teacher profile including manager info
    """
    emp_id = token_data.get("emp_id")
    role = token_data.get("role")
    
    if role != "home-teacher":
        raise HTTPException(
            status_code=403,
            detail={"message": "Only home teachers can access this endpoint"}
        )
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Get home teacher details
        cursor.execute(
            """
            SELECT ht.id, ht.name, ht.email, ht.phn, ht.city, ht.state, 
                   ht.created_at, ht.manager_id,
                   fm.name as manager_name, fm.email as manager_email, 
                   fm.phn as manager_phone, fm.city as manager_city, fm.state as manager_state
            FROM employees ht
            LEFT JOIN employees fm ON ht.manager_id = fm.id
            WHERE ht.id = %s
            """,
            (emp_id,)
        )
        
        profile_data = cursor.fetchone()
        
        if not profile_data:
            raise HTTPException(
                status_code=404,
                detail={"message": "Profile not found"}
            )
        
        # Calculate employment duration
        employment_date = profile_data['created_at']
        current_date = datetime.now()
        
        if employment_date:
            duration_days = (current_date - employment_date).days
            duration_months = duration_days // 30
            
            if duration_months < 1:
                employment_duration = f"{duration_days} days"
            else:
                employment_duration = f"{duration_months} month{'s' if duration_months > 1 else ''}"
        else:
            employment_duration = "N/A"
        
        # Prepare response
        profile = {
            "employee_info": {
                "id": profile_data['id'],
                "name": profile_data['name'],
                "email": profile_data['email'],
                "phone": profile_data['phn'],
                "city": profile_data['city'],
                "state": profile_data['state'],
                "employment_date": employment_date.isoformat() if employment_date else None,
                "employment_duration": employment_duration,
                "monthly_salary": 1050  
            },
            "manager_info": {
                "name": profile_data['manager_name'],
                "email": profile_data['manager_email'],
                "phone": profile_data['manager_phone'],
                "city": profile_data['manager_city'],
                "state": profile_data['manager_state']
            } if profile_data['manager_name'] else None
        }
        
        return {
            "status": "success",
            "profile": profile,
            "message": "Profile retrieved successfully"
        }
        
    except HTTPException:
        raise
    except Exception as err:
        raise_http_error("Cannot fetch profile", err)
    finally:
        conn.close()


@app.post("/post/get_manager_commission_history")
async def get_manager_commission_history_branch(
    data: HistoryRequest,
    token_data: dict = Depends(get_login_role)
):
    """
    Get commission history for branch dashboard (all managers)
    """
    user_role = token_data.get("role")
    user_id = token_data.get("emp_id")
    
    if user_role not in ["admin", "branch"]:
        raise HTTPException(
            status_code=403,
            detail={"message": "Insufficient permissions"}
        )
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        today = datetime.today().date()
        start_date = data.start_date
        end_date = data.end_date
        
        # Set default date range if not provided
        if not start_date and not end_date:
            end_date = today
            start_date = today - timedelta(days=90)  # Last 3 months
        elif start_date and not end_date:
            max_end = start_date + timedelta(days=90)
            end_date = min(max_end, today)
        elif start_date and end_date:
            if (end_date - start_date).days > 365:  # Max 1 year range
                raise HTTPException(
                    status_code=400,
                    detail={"message": "Date range cannot exceed 1 year"}
                )
            if end_date > today:
                end_date = today
        
        # Get all commission history for branch dashboard
        query = """
            SELECT 
                c.id,
                c.manager_id,
                c.field_manager_id,
                c.manager_commision,
                c.field_manager_commision,
                c.created_role,
                c.created_id,
                c.registered_at,
                m.name as manager_name,
                fm.name as field_manager_name,
                e.name as created_employee_name
            FROM commisions c
            LEFT JOIN employees m ON c.manager_id = m.id
            LEFT JOIN employees fm ON c.field_manager_id = fm.id
            LEFT JOIN employees e ON c.created_id = e.id
            WHERE DATE(c.registered_at) BETWEEN %s AND %s
            ORDER BY c.registered_at DESC
        """
        
        cursor.execute(query, (start_date, end_date))
        history = cursor.fetchall()
        
        # Calculate summary
        total_manager_commission = sum(h['manager_commision'] or 0 for h in history)
        total_field_manager_commission = sum(h['field_manager_commision'] or 0 for h in history)
        field_managers = len([h for h in history if h['created_role'] == 'field-manager'])
        home_teachers = len([h for h in history if h['created_role'] == 'home-teacher'])
        
        return {
            "status": "success",
            "commission_history": history,
            "summary": {
                "total_manager_commission": total_manager_commission,
                "total_field_manager_commission": total_field_manager_commission,
                "field_managers_recruited": field_managers,
                "home_teachers_recruited": home_teachers,
                "total_registrations": len(history),
                "date_range": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as err:
        raise_http_error("Cannot fetch commission history", err)
    finally:
        conn.close()


@app.get("/get_field_manager_home_teachers/{field_manager_id}")
async def get_field_manager_home_teachers(field_manager_id: str, token_data: dict = Depends(get_login_role)):
    """
    Get all home teachers under a specific field manager
    """
    user_role = token_data.get("role")
    user_id = token_data.get("emp_id")
    
    # Check authorization
    if user_role not in ["admin", "branch"] and user_id != field_manager_id:
        # Check if it's a manager requesting data about their field manager
        if user_role == "manager":
            conn = get_db_connection()
            cursor = conn.cursor()
            try:
                cursor.execute("SELECT manager_id FROM employees WHERE id = %s", (field_manager_id,))
                result = cursor.fetchone()
                if not result or result[0] != user_id:
                    raise HTTPException(status_code=403, detail="Unauthorized access")
            finally:
                conn.close()
        else:
            raise HTTPException(status_code=403, detail="Unauthorized access")
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Get field manager info first
        cursor.execute("""
            SELECT e.id, e.name, e.email, e.created_at, m.name as manager_name
            FROM employees e
            LEFT JOIN employees m ON e.manager_id = m.id
            WHERE e.id = %s AND e.role = 'field-manager'
        """, (field_manager_id,))
        
        field_manager_info = cursor.fetchone()
        if not field_manager_info:
            raise HTTPException(status_code=404, detail="Field manager not found")
        
        # Get all home teachers under this field manager
        cursor.execute("""
            SELECT id, name, email, phn, city, state, created_at
            FROM employees 
            WHERE role = 'home-teacher' AND manager_id = %s
            ORDER BY created_at DESC
        """, (field_manager_id,))
        
        home_teachers = cursor.fetchall()
        
        # Get field manager's commissions
        cursor.execute("""
            SELECT c.*, e.name as created_employee_name
            FROM commisions c
            LEFT JOIN employees e ON c.created_id = e.id
            WHERE c.field_manager_id = %s AND c.created_role = 'home-teacher'
            ORDER BY c.registered_at DESC
        """, (field_manager_id,))
        
        commissions = cursor.fetchall()
        
        return {
            "status": "success",
            "field_manager_info": field_manager_info,
            "home_teachers": home_teachers,
            "commissions": commissions,
            "total_home_teachers": len(home_teachers),
            "total_commission": sum(c['field_manager_commision'] or 0 for c in commissions)
        }
        
    except HTTPException:
        raise
    except Exception as err:
        raise_http_error("Cannot fetch field manager home teachers", err)
    finally:
        conn.close()


@app.get("/get_manager_field_managers/{manager_id}")
async def get_manager_field_managers(manager_id: str, token_data: dict = Depends(get_login_role)):
    """
    Get all field managers under a specific manager with their home teacher counts
    """
    user_role = token_data.get("role")
    user_id = token_data.get("emp_id")
    
    # Check authorization
    if user_role not in ["admin", "branch"] and user_id != manager_id:
        raise HTTPException(status_code=403, detail="Unauthorized access")
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Get manager info first
        cursor.execute("""
            SELECT id, name, email, funds, created_at
            FROM employees 
            WHERE id = %s AND role = 'manager'
        """, (manager_id,))
        
        manager_info = cursor.fetchone()
        if not manager_info:
            raise HTTPException(status_code=404, detail="Manager not found")
        
        # Get all field managers under this manager
        cursor.execute("""
            SELECT id, name, email, funds, created_at
            FROM employees 
            WHERE role = 'field-manager' AND manager_id = %s
            ORDER BY created_at DESC
        """, (manager_id,))
        
        field_managers = cursor.fetchall()
        
        # For each field manager, get home teacher count
        for fm in field_managers:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM employees 
                WHERE role = 'home-teacher' AND manager_id = %s
            """, (fm['id'],))
            
            count_result = cursor.fetchone()
            fm['home_teachers_count'] = count_result['count'] if count_result else 0
        
        # Get manager's total commissions
        cursor.execute("""
            SELECT SUM(manager_commision) as total_commission
            FROM commisions
            WHERE manager_id = %s
        """, (manager_id,))
        
        commission_result = cursor.fetchone()
        total_commission = commission_result['total_commission'] if commission_result else 0
        
        return {
            "status": "success",
            "manager_info": manager_info,
            "field_managers": field_managers,
            "total_field_managers": len(field_managers),
            "total_commission": total_commission or 0
        }
        
    except HTTPException:
        raise
    except Exception as err:
        raise_http_error("Cannot fetch manager field managers", err)
    finally:
        conn.close()