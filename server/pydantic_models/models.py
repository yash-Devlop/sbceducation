from pydantic import BaseModel, EmailStr, Field, validator
from datetime import date, datetime
from typing import Optional, List

class Admin_login_request(BaseModel):
    username: str
    pwd: str

class emp_login_request(BaseModel):
    email: EmailStr
    pwd: str
    role: str

# class Get_commison_request(BaseModel):
#     emp_id

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
    manager_id: Optional[str] = None


class create_manager_request(BaseModel):
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

class SalarySlipRequest(BaseModel):
    """Request model for generating salary slip"""
    month: int = Field(..., ge=1, le=12, description="Month (1-12)")
    year: int = Field(..., ge=2020, le=2030, description="Year (2020-2030)")
    
    @validator('month')
    def validate_month(cls, v):
        if not 1 <= v <= 12:
            raise ValueError('Month must be between 1 and 12')
        return v
    
    @validator('year')
    def validate_year(cls, v):
        current_year = datetime.now().year
        if not (current_year - 5) <= v <= current_year:
            raise ValueError(f'Year must be between {current_year - 5} and {current_year}')
        return v

class HomeTeacherSalaryInfo(BaseModel):
    """Salary information for home teacher"""
    employee_id: str
    employee_name: str
    designation: str = "Home Teacher"
    department: str = "Education"
    basic_salary: float = 1000.0
    allowances: float = 50.0
    deductions: float = 0.0
    net_salary: float = 1050.0
    
    class Config:
        schema_extra = {
            "example": {
                "employee_id": "HT001",
                "employee_name": "John Doe",
                "designation": "Home Teacher",
                "department": "Education",
                "basic_salary": 1000.0,
                "allowances": 50.0,
                "deductions": 0.0,
                "net_salary": 1050.0
            }
        }

class SalarySlipHistoryItem(BaseModel):
    """Individual salary slip history item"""
    month: int
    year: int
    generated_at: datetime
    
class SalarySlipHistoryResponse(BaseModel):
    """Response model for salary slip history"""
    status: str
    history: List[SalarySlipHistoryItem]
    message: str

class HomeTeacherEmployeeInfo(BaseModel):
    """Home teacher employee information"""
    id: str
    name: str
    email: str
    phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    employment_date: Optional[datetime] = None
    employment_duration: str
    monthly_salary: int = 1050

class HomeTeacherManagerInfo(BaseModel):
    """Home teacher's manager information"""
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None

class HomeTeacherProfileResponse(BaseModel):
    """Complete home teacher profile response"""
    status: str
    profile: dict
    message: str
    
    class Config:
        schema_extra = {
            "example": {
                "status": "success",
                "profile": {
                    "employee_info": {
                        "id": "HT001",
                        "name": "John Doe",
                        "email": "john@example.com",
                        "phone": "+91-9876543210",
                        "city": "Mumbai",
                        "state": "Maharashtra",
                        "employment_date": "2024-01-15T10:30:00",
                        "employment_duration": "8 months",
                        "monthly_salary": 1050
                    },
                    "manager_info": {
                        "name": "Field Manager Name",
                        "email": "fm@example.com",
                        "phone": "+91-9876543211",
                        "city": "Mumbai",
                        "state": "Maharashtra"
                    }
                },
                "message": "Profile retrieved successfully"
            }
        }

class HomeTeacherFundsResponse(BaseModel):
    """Response for home teacher funds (always 0)"""
    status: str
    detail: dict
    
    class Config:
        schema_extra = {
            "example": {
                "status": "good",
                "detail": {
                    "message": "Funds fetched successfully",
                    "funds": 0
                }
            }
        }

class SalarySlipGenerationResponse(BaseModel):
    """Response for salary slip generation"""
    status: str
    salary_slip: HomeTeacherSalaryInfo
    generation_date: str
    message: str