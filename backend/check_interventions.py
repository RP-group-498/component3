"""
Quick script to check if intervention data is being logged to database
"""
import asyncio
import sys
sys.path.insert(0, '/Users/nipun/Desktop/Projects/component3/backend')

from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    # Connect to MongoDB
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['focus_task_manager']
    collection = db['ml_training_data']

    # Count total records
    total = await collection.count_documents({})
    print(f'Total ML training records: {total}')

    # Count intervention records
    intervention_count = await collection.count_documents({'event_type': 'intervention_displayed'})
    print(f'Intervention records: {intervention_count}')

    # Show intervention breakdown
    if intervention_count > 0:
        print('\nRecent interventions:')
        cursor = collection.find({'event_type': 'intervention_displayed'}).sort('timestamp', -1).limit(10)
        records = await cursor.to_list(length=10)

        for i, doc in enumerate(records, 1):
            accepted = 'Accepted' if doc.get('intervention_accepted') else 'Rejected'
            print(f"  {i}. {doc.get('intervention_type', 'N/A'):20s} {accepted:15s} Motivation: {doc.get('motivation', 0):.2f}")
    else:
        print('\nNo intervention records found.')
        print('This could mean:')
        print('  1. No real TMT-based interventions have been triggered yet')
        print('  2. Users haven\'t interacted with interventions (accepted/rejected)')
        print('  3. The logging endpoint might not be working')

    # Check other event types
    print('\nEvent type breakdown:')
    pipeline = [
        {'$group': {'_id': '$event_type', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}}
    ]
    event_types = await collection.aggregate(pipeline).to_list(length=None)
    for event in event_types:
        print(f"  {event['_id']:30s}: {event['count']}")

    client.close()

if __name__ == '__main__':
    asyncio.run(main())
