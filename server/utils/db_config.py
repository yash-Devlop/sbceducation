from mysql.connector import connect
from dotenv import load_dotenv
import os

load_dotenv()

HOST = os.getenv("HOST")
USER = os.getenv("USER")
PWD = os.getenv("PWD")
DATABASE = os.getenv("DATABASE")

database_exists = False

def get_db_connection():
    conn = connect(
        host=HOST,
        user=USER,
        password=PWD,
        database=DATABASE
    )

    return conn


def initialize_empty_tables():
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        print("[INFO]: INITIALIZING EMPTY TABLES")

        # Employees table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS employees (
                id VARCHAR(26) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                fname VARCHAR(100) NOT NULL,
                mname VARCHAR(100) NOT NULL,
                DOB DATE NOT NULL,
                addr VARCHAR(100),
                city VARCHAR(20),
                district VARCHAR(20),
                state VARCHAR(20),
                email VARCHAR(100) UNIQUE NOT NULL,
                phn VARCHAR(20) UNIQUE NOT NULL,
                password VARCHAR(50) NOT NULL,
                role VARCHAR(50) NOT NULL,
                manager_id VARCHAR(26) DEFAULT NULL,
                funds INT DEFAULT 0,
                created_at DATETIME,
                CONSTRAINT fk_manager 
                    FOREIGN KEY (manager_id) 
                    REFERENCES employees(id) 
                    ON DELETE SET NULL
            )
        """)

        # Funds transfer history table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS funds_transfer_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sender_id VARCHAR(26),
                transferred_amount INT NOT NULL,
                reciever_id VARCHAR(26),
                transferred_at DATETIME,
                CONSTRAINT fk_sender 
                    FOREIGN KEY (sender_id) 
                    REFERENCES employees(id) 
                    ON DELETE SET NULL,
                CONSTRAINT fk_receiver 
                    FOREIGN KEY (reciever_id) 
                    REFERENCES employees(id) 
                    ON DELETE SET NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS commisions(
                id INT AUTO_INCREMENT PRIMARY KEY,
                manager_id VARCHAR(26) NOT NULL,
                field_manager_id VARCHAR(26),
                manager_commision INT,
                field_manager_commision INT,
                created_role VARCHAR(20),
                created_id VARCHAR(26),
                registered_at DATETIME
            );
        """)
    
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS salary_slip_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id VARCHAR(20) NOT NULL,
                month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
                year INT NOT NULL CHECK (year BETWEEN 2020 AND 2030),
                generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_employee_month_year (employee_id, month, year),
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
                INDEX idx_employee_date (employee_id, year DESC, month DESC),
                INDEX idx_generated_at (generated_at DESC)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_querry (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(50),
                email VARCHAR(60),
                phn VARCHAR(13),
                querry VARCHAR(255),
                created_at DATETIME
            );
        """)

        conn.commit()
        print("[INFO]: EMPTY TABLES CREATED")

    except Exception as err:
        print("[INFO]:  CANNOT CREATE TABLES")
        print(err)
    finally:
        conn.close()


def initialize_db():
    global database_exists
    conn = connect(
        host=HOST,
        user=USER,
        password=PWD
    )
    cursor = conn.cursor()

    try:
        cursor.execute("SHOW DATABASES")
        databases = [db[0] for db in cursor.fetchall()]

        database_exists = DATABASE in databases

        if not database_exists:
            cursor.execute(F"CREATE DATABASE IF NOT EXISTS {DATABASE};")
            initialize_empty_tables()
        else:
            print("[INFO]:  DATABASE ALREADY EXISTS")
    
    except Exception as err:
        print("[INFO]:  CANNOT CREATE DATABASE")
        print(err)
    finally: 
        conn.close()


