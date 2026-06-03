FROM python:3.12-slim-bookworm

RUN pip install --no-cache-dir uv

WORKDIR /app
COPY pyproject.toml ./
RUN uv pip install --system .

COPY main.py ./
COPY config/ ./config/
COPY database/ ./database/
COPY model/ ./model/
COPY service/ ./service/

CMD ["python", "main.py"]
