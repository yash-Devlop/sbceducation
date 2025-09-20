from utils.db_config import get_db_connection
from datetime import date
from main import get_today_datetime_sql_format

def add_funds_daily(amount: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("UPDATE employees SET funds = funds + %s", (amount,))
        conn.commit()
        print(f"Today's funds updated amount: {str(amount)}")
        
    except Exception as e:
        print(f"[INFO]:  Cannnot add daily fund amount: {str(amount)}")
        print(f"[ERR]: {str(e)}")


def add_salary_hometeacher(amount: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        today = date.today()
        salary_month = today.replace(day=1)
        credited_at = get_today_datetime_sql_format()

        # Get all home-teachers
        cursor.execute("SELECT id FROM employees WHERE role = %s", ("home-teacher",))
        hometeachers = cursor.fetchall()

        for (emp_id,) in hometeachers:
            cursor.execute("""
                SELECT id FROM salary_history 
                WHERE emp_id = %s AND salary_month = %s
            """, (emp_id, salary_month))
            exists = cursor.fetchone()

            if not exists:
                cursor.execute("UPDATE employees SET funds = funds + %s WHERE id = %s", (amount, emp_id))

                cursor.execute("""
                    INSERT INTO salary_history (emp_id, salary_amount, salary_month, credited_at, status)
                    VALUES (%s, %s, %s, %s, 'credited')
                """, (emp_id, amount, salary_month, credited_at))

        conn.commit()
        print(f"[INFO]: Salary of {amount} credited for all home-teachers for {salary_month}")

    except Exception as e:
        print("cannot add monthly salary for hometeachers")
        print(f"[ERR]: {str(e)}")
    finally:
        conn.close()