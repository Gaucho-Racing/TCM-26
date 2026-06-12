FROM python:3.12-slim-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

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
