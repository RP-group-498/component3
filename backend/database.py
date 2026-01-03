from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
import certifi

class Database:
    client: AsyncIOMotorClient = None
    db = None

    def connect(self):
        """Connect to MongoDB"""
        self.client = AsyncIOMotorClient(
            settings.MONGODB_URL,
            tlsCAFile=certifi.where(),
            tls=True
        )
        self.db = self.client[settings.MONGODB_DB_NAME]
        print(f"Connected to MongoDB at {settings.MONGODB_URL}")

    def close(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            print("Closed MongoDB connection")

    def get_collection(self, collection_name: str):
        """Get a collection"""
        if self.db is None:
            raise Exception("Database not connected")
        return self.db[collection_name]

db = Database()
