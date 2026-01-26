# Database and configuration utilities

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Boomerang API configuration
BOOMERANG_API_BASE = os.environ.get('BOOMERANG_API_BASE', 'https://api.digitalwallet.cards/api/v2')
BOOMERANG_API_KEY = os.environ.get('BOOMERANG_API_KEY', '')

# JWT configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'scanner-app-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24
