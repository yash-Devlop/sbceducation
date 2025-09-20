from pydantic import BaseModel, EmailStr
from datetime import date
from typing import Optional

class Admin_login_request(BaseModel):
    username: str
    pwd: str

class emp_login_request(BaseModel):
    email: EmailStr
    pwd: str
    role: str

class create_emp_request(BaseModel):
    name: str
    fname: str
    mname: str
    dob: date
    addr: str
    city: str
    district: str
    state: str
    email: EmailStr
    phn: str
    pwd: str
    role: str

class Add_funds_request(BaseModel):
    amount: int
    receiver_id: str

class HistoryRequest(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class User_querry_request(BaseModel):
    name: str
    email: EmailStr
    phn: str
    querry: str