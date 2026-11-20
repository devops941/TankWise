import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .database import connect_db, close_db
from .config import get_settings
from .routers import auth as auth_router
from .routers import tanks as tanks_router
from .routers import readings as readings_router
from .routers import validate as validate_router
from .routers import calc as calc_router
from .routers import analytics as analytics_router
from .routers import reports as reports_router
from .routers import seed as seed_router
from .routers import refills as refills_router
from .routers import weather as weather_router

logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","message":"%(message)s"}'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting TankWise backend")
    await connect_db()
    yield
    await close_db()
    logger.info("TankWise backend stopped")

settings = get_settings()
app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Water Tank Usage Intelligence & Refill Cycle Analysis",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(tanks_router.router)
app.include_router(readings_router.router)
app.include_router(validate_router.router)
app.include_router(calc_router.router)
app.include_router(analytics_router.router)
app.include_router(reports_router.router)
app.include_router(seed_router.router)
app.include_router(refills_router.router)
app.include_router(weather_router.router)

@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.app_name, "version": "1.0.0"}

@app.get("/metrics")
async def metrics():
    return {"status": "ok", "uptime": "running"}
