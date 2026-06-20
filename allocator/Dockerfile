FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONPATH=/app

RUN mkdir -p allocator && \
    mv app.py algorithm.py schema.py __init__.py __pycache__ allocator/ 2>/dev/null || true

EXPOSE 8000

CMD ["uvicorn", "allocator.app:app", "--host", "0.0.0.0", "--port", "8000"]