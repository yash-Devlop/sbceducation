from fastapi import HTTPException

def raise_http_error(message: str, err: Exception = None):
    status_code = 500

    detail = {
    "message": message,
    "error": str(err)
    }

    raise HTTPException(status_code=status_code, detail=detail)
