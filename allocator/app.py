from typing import Optional
import uvicorn
from fastapi import FastAPI, Header
from allocator.schema import AllocateRequest, AllocateResponse
from allocator.algorithm import run_allocation

APP_VERSION = "v1.0.0"
PORT = 8000

app = FastAPI(title="Allocator Service", version=APP_VERSION)

@app.post("/v1/allocate", response_model=AllocateResponse)
def allocate(req: AllocateRequest, authorization: Optional[str] = Header(default=None)):
    return run_allocation(req)

@app.get("/v1/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("allocator.app:app", host="0.0.0.0", port=PORT, reload=True)
