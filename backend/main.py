
from fastapi import FastAPI

app = FastAPI(title="Political-SAAS API")

@app.get("/")
def home():
    return {"message": "Political-SAAS Backend is running!"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
