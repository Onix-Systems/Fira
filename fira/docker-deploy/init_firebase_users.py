#!/usr/bin/env python3
"""
Initialize Firebase with test users
Run this script to add test users to Firestore
"""

from firebase_service import firebase_service, create_user, is_firebase_available
import sys
import secrets

def init_test_users():
    """Initialize test users in Firebase"""
    
    if not is_firebase_available():
        print("❌ Firebase is not available. Check your configuration.")
        return False
    
    test_users = [
        {
            'email': 'admin@fira.local',
            'username': 'admin',
            'role': 'admin',
            'password': secrets.token_urlsafe(12)
        },
        {
            'email': 'user@fira.local', 
            'username': 'user',
            'role': 'user',
            'password': secrets.token_urlsafe(12)
        },
        {
            'email': 'fira@fira.local',
            'username': 'fira',
            'role': 'admin',
            'password': secrets.token_urlsafe(12)
        },
        {
            'email': 'test@fira.local',
            'username': 'test',
            'role': 'user', 
            'password': secrets.token_urlsafe(12)
        }
    ]
    
    print("🔥 Initializing Firebase test users...")
    
    for user in test_users:
        try:
            # Check if user already exists
            existing_user = firebase_service.get_user_by_email(user['email'])
            if existing_user:
                print(f"👤 User {user['email']} already exists, skipping...")
                continue
            
            # Create user document in Firestore
            db = firebase_service.db
            if db:
                user_data = {
                    'email': user['email'],
                    'username': user['username'],
                    'role': user['role'],
                    'password': user['password'],  # TODO: store a hash instead
                    'active': True,
                    'created_at': db.server_timestamp()
                }
                
                doc_ref = db.collection('users').add(user_data)
                print(f"✅ Created user: {user['email']} / password: {user['password']} (ID: {doc_ref[1].id})")
            
        except Exception as e:
            print(f"❌ Failed to create user {user['email']}: {e}")
    
    print("\n🎉 Firebase user initialization completed!")
    return True

def main():
    """Main function"""
    if len(sys.argv) > 1 and sys.argv[1] == 'init':
        init_test_users()
    else:
        print("Usage: python init_firebase_users.py init")
        print("\nThis will create test users in Firebase:")
        print("- admin@fira.local, user@fira.local, fira@fira.local, test@fira.local")
        print("Random passwords are generated and printed once on creation.")

if __name__ == '__main__':
    main()