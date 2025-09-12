#!/usr/bin/env python3
"""
Firebase Admin SDK Service
Handles Firebase authentication and Firestore operations
"""

import json
import os
from pathlib import Path
from typing import Optional, Dict, Any, List
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FirebaseService:
    def __init__(self, service_account_path: str = None):
        self.db = None
        self.app = None
        self.initialized = False
        
        # Try to initialize Firebase Admin SDK
        self._initialize_firebase(service_account_path)
    
    def _initialize_firebase(self, service_account_path: str = None):
        """Initialize Firebase Admin SDK"""
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore
            
            # Multiple service account file paths to try (production vs development)
            possible_paths = []
            
            if service_account_path:
                possible_paths.append(Path(service_account_path))
            
            # Try production path first (Docker container)
            possible_paths.extend([
                Path('/app/fira-f7d95-firebase-adminsdk-fbsvc-406f223c92.json'),
                Path('fira-f7d95-firebase-adminsdk-fbsvc-406f223c92.json'),
                Path('admin/fira-f7d95-firebase-adminsdk-fbsvc-406f223c92.json'),
                # Fallback to existing file for local development
                Path(__file__).parent / 'admin' / 'fira-f7d95-firebase-adminsdk-fbsvc-406f223c92.json'
            ])
            
            service_account_found = None
            for path in possible_paths:
                if path.exists():
                    service_account_found = path
                    break
            
            if not service_account_found:
                logger.warning(f"Firebase service account file not found in any of these locations:")
                for path in possible_paths:
                    logger.warning(f"  - {path}")
                return
            
            logger.info(f"🔥 Initializing Firebase with service account: {service_account_found}")
            
            # Initialize Firebase app if not already done
            if not firebase_admin._apps:
                cred = credentials.Certificate(str(service_account_found))
                self.app = firebase_admin.initialize_app(cred)
                logger.info("✅ Firebase Admin SDK initialized successfully")
            else:
                self.app = firebase_admin.get_app()
                logger.info("✅ Using existing Firebase Admin SDK instance")
            
            # Initialize Firestore client
            self.db = firestore.client()
            self.initialized = True
            logger.info("✅ Firestore client ready")
            
        except ImportError:
            logger.warning("⚠️ firebase-admin package not installed. Firebase features disabled.")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Firebase: {e}")
            logger.error(f"   Service account tried: {service_account_found if 'service_account_found' in locals() else 'None'}")
    
    def is_available(self) -> bool:
        """Check if Firebase is available and initialized"""
        return self.initialized and self.db is not None
    
    def authenticate_user(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """
        Authenticate user against Firebase
        Note: Firebase Admin SDK doesn't support password auth directly,
        so this is a placeholder for custom user validation
        """
        if not self.is_available():
            logger.warning("Firebase not available, falling back to local auth")
            return None
        
        try:
            # Check if user exists in Firestore users collection
            users_ref = self.db.collection('users')
            query = users_ref.where('email', '==', email).limit(1)
            docs = query.stream()
            
            for doc in docs:
                user_data = doc.to_dict()
                # In real implementation, you'd hash and compare passwords
                # For now, just check if user exists
                logger.info(f"Found user in Firebase: {email}")
                return {
                    'id': doc.id,
                    'email': user_data.get('email'),
                    'username': user_data.get('username', email.split('@')[0]),
                    'role': user_data.get('role', 'user')
                }
            
            logger.info(f"User not found in Firebase: {email}")
            return None
            
        except Exception as e:
            logger.error(f"Firebase authentication error: {e}")
            return None
    
    def create_user(self, email: str, username: str, role: str = 'user', password: str = None, ip_address: str = None) -> bool:
        """Create a new user in Firestore with IP tracking"""
        if not self.is_available():
            logger.warning("🔄 Firebase not available, cannot create user")
            return False
        
        try:
            # Use email as document ID for easier lookup
            users_ref = self.db.collection('users')
            doc_ref = users_ref.document(email)
            
            # Import firestore for SERVER_TIMESTAMP
            from firebase_admin import firestore
            
            user_data = {
                'email': email,
                'username': username,
                'role': role,
                'password': password,  # In production, should be hashed
                'ip_address': ip_address,
                'created_at': firestore.SERVER_TIMESTAMP,
                'active': True,
                'status': 'created'
            }
            
            # Set document with email as ID
            doc_ref.set(user_data)
            logger.info(f"✅ Created user in Firebase: {username} ({email}) from IP {ip_address}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to create user in Firebase: {e}")
            return False
    
    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email from Firestore"""
        if not self.is_available():
            return None
        
        try:
            users_ref = self.db.collection('users')
            query = users_ref.where('email', '==', email).limit(1)
            docs = query.stream()
            
            for doc in docs:
                user_data = doc.to_dict()
                user_data['id'] = doc.id
                return user_data
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting user: {e}")
            return None
    
    def validate_admin_credentials(self, username: str, password: str) -> bool:
        """
        Validate admin credentials for admin panel access
        Can be extended to use Firebase or custom logic
        """
        # Always try Firebase first if available
        if self.is_available():
            try:
                # Check admin users in Firebase
                users_ref = self.db.collection('users')
                query = users_ref.where('username', '==', username).where('role', '==', 'admin').limit(1)
                docs = query.stream()
                
                for doc in docs:
                    user_data = doc.to_dict()
                    # In production, use proper password hashing
                    stored_password = user_data.get('password')
                    if stored_password == password:
                        logger.info(f"✅ Admin authenticated via Firebase: {username}")
                        return True
                
                logger.info(f"❌ Firebase admin authentication failed: {username}")
                
            except Exception as e:
                logger.error(f"Firebase admin validation error: {e}")
        
        # Fallback to local admin credentials when Firebase is not available or fails
        logger.info(f"🔄 Falling back to local admin authentication for: {username}")
        admin_credentials = [
            {'username': 'admin', 'password': 'admin123'},
            {'username': 'fira', 'password': 'fira2024'},
            {'username': 'admin', 'password': '3Bm6iDAY46vK57aj'}  # Match mini-server ADMIN_PASSWORD
        ]
        
        is_valid = any(cred['username'] == username and cred['password'] == password 
                      for cred in admin_credentials)
        
        if is_valid:
            logger.info(f"✅ Local admin authentication successful: {username}")
        else:
            logger.warning(f"❌ Local admin authentication failed: {username}")
            
        return is_valid
    
    def log_user_activity(self, user_id: str, action: str, details: Dict[str, Any] = None):
        """Log user activity to Firestore"""
        if not self.is_available():
            return
        
        try:
            activity_ref = self.db.collection('user_activity')
            activity_data = {
                'user_id': user_id,
                'action': action,
                'details': details or {},
                'timestamp': firestore.SERVER_TIMESTAMP
            }
            
            activity_ref.add(activity_data)
            logger.info(f"📝 Logged activity: {action} for user {user_id}")
            
        except Exception as e:
            logger.error(f"Failed to log activity: {e}")

# Global instance
firebase_service = FirebaseService()

# Helper functions for easy access
def is_firebase_available() -> bool:
    return firebase_service.is_available()

def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    return firebase_service.authenticate_user(email, password)

def validate_admin_credentials(username: str, password: str) -> bool:
    return firebase_service.validate_admin_credentials(username, password)

def create_user(email: str, username: str, role: str = 'user') -> bool:
    return firebase_service.create_user(email, username, role)

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    return firebase_service.get_user_by_email(email)

def log_user_activity(user_id: str, action: str, details: Dict[str, Any] = None):
    return firebase_service.log_user_activity(user_id, action, details)

# Additional functions for admin panel - Firebase apps management
def get_firebase_apps() -> List[Dict[str, Any]]:
    """Get all apps from Firebase 'apps' collection"""
    if not firebase_service.is_available():
        logger.warning("🔄 Firebase not available, returning demo apps list")
        # Return demo data when Firebase is not available
        return [
            {
                'id': 'demo-app-001',
                'originalName': 'sample-app-v1.0.apk',
                'status': 2,  # Success
                'timestamp': 1693756800000,  # Sept 3, 2023
                'uploadIP': '127.0.0.1',
                'hash': 'abc123def456'
            },
            {
                'id': 'demo-app-002', 
                'originalName': 'test-application.apk',
                'status': 1,  # Processing
                'timestamp': 1693843200000,  # Sept 4, 2023
                'uploadIP': '192.168.1.100',
                'hash': 'def456ghi789'
            },
            {
                'id': 'demo-app-003',
                'originalName': 'production-build.apk',
                'status': 0,  # Queued
                'timestamp': 1693929600000,  # Sept 5, 2023
                'uploadIP': '10.0.0.50', 
                'hash': 'ghi789jkl012'
            },
            {
                'id': 'demo-app-004',
                'originalName': 'invalid-format.txt',
                'status': 4,  # Invalid format
                'timestamp': 1694016000000,  # Sept 6, 2023
                'uploadIP': '172.16.0.25',
                'hash': 'jkl012mno345'
            },
            {
                'id': 'demo-app-005',
                'originalName': 'failed-processing.apk',
                'status': 3,  # Error
                'timestamp': 1694102400000,  # Sept 7, 2023
                'uploadIP': '192.168.1.200',
                'hash': 'mno345pqr678'
            }
        ]
    
    try:
        apps_ref = firebase_service.db.collection('apps')
        docs = apps_ref.stream()
        
        apps = []
        for doc in docs:
            app_data = doc.to_dict()
            app_data['id'] = doc.id
            apps.append(app_data)
        
        logger.info(f"✅ Retrieved {len(apps)} apps from Firebase")
        return apps
        
    except Exception as e:
        logger.error(f"❌ Error getting Firebase apps: {e}")
        # Return demo data on Firebase error
        logger.info("🔄 Returning demo apps due to Firebase error")
        return []

def update_firebase_app(app_id: str, data: Dict[str, Any]) -> bool:
    """Update app in Firebase 'apps' collection"""
    if not firebase_service.is_available():
        logger.warning("Firebase not available, cannot update app")
        return False
    
    try:
        doc_ref = firebase_service.db.collection('apps').document(app_id)
        doc_ref.update(data)
        logger.info(f"✅ Updated Firebase app {app_id}: {data}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error updating Firebase app {app_id}: {e}")
        return False

def delete_firebase_app(app_id: str) -> bool:
    """Delete app from Firebase 'apps' collection"""
    if not firebase_service.is_available():
        logger.warning("Firebase not available, cannot delete app")
        return False
    
    try:
        doc_ref = firebase_service.db.collection('apps').document(app_id)
        doc_ref.delete()
        logger.info(f"🗑️ Deleted Firebase app {app_id}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error deleting Firebase app {app_id}: {e}")
        return False

def get_firebase_users() -> List[Dict[str, Any]]:
    """Get all users from Firebase 'users' collection"""
    logger.info("🔍 get_firebase_users called")
    
    if not firebase_service.is_available():
        logger.warning("🔄 Firebase not available, returning demo users list")
        # Return demo data when Firebase is not available
        return [
            {
                'id': 'demo-user-001',
                'email': 'admin@example.com',
                'username': 'admin',
                'role': 'editor',
                'active': True,
                'created_at': 1693756800000,  # Sept 3, 2023
                'ip_address': '127.0.0.1'
            },
            {
                'id': 'demo-user-002',
                'email': 'user@example.com', 
                'username': 'testuser',
                'role': 'viewer',
                'active': True,
                'created_at': 1693843200000,  # Sept 4, 2023
                'ip_address': '192.168.1.100'
            },
            {
                'id': 'demo-user-003',
                'email': 'fira@example.com',
                'username': 'fira',
                'role': 'editor',
                'active': True,
                'created_at': 1693929600000,  # Sept 5, 2023
                'ip_address': '10.0.0.1'
            }
        ]
    
    try:
        users_ref = firebase_service.db.collection('users')
        docs = users_ref.stream()
        
        users = []
        for doc in docs:
            user_data = doc.to_dict()
            user_data['id'] = doc.id
            
            # Convert timestamp to milliseconds if needed
            if 'created_at' in user_data and user_data['created_at']:
                try:
                    created_at = user_data['created_at']
                    if hasattr(created_at, 'timestamp'):
                        user_data['created_at'] = int(created_at.timestamp() * 1000)
                except:
                    user_data['created_at'] = None
                    
            users.append(user_data)
        
        logger.info(f"✅ Retrieved {len(users)} users from Firebase")
        return users
        
    except Exception as e:
        logger.error(f"❌ Error getting Firebase users: {e}")
        # Return demo data on Firebase error
        logger.info("🔄 Returning demo users due to Firebase error")
        return []

def update_user_role(user_id: str, new_role: str) -> bool:
    """Update user role in Firebase"""
    if not firebase_service.is_available():
        logger.warning("🔄 Firebase not available, cannot update user role")
        return False
    
    try:
        # Update user role in Firestore
        doc_ref = firebase_service.db.collection('users').document(user_id)
        
        # Check if user exists
        doc = doc_ref.get()
        if not doc.exists:
            logger.error(f"❌ User {user_id} not found in Firebase")
            return False
        
        # Update the role field
        doc_ref.update({'role': new_role})
        logger.info(f"✅ Updated user {user_id} role to {new_role} in Firebase")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to update user {user_id} role in Firebase: {e}")
        return False

def toggle_user_status(user_id: str, active: bool) -> bool:
    """Toggle user active status in Firebase"""
    if not firebase_service.is_available():
        logger.warning("🔄 Firebase not available, cannot toggle user status")
        return False
    
    try:
        # Update user status in Firestore
        doc_ref = firebase_service.db.collection('users').document(user_id)
        
        # Check if user exists
        doc = doc_ref.get()
        if not doc.exists:
            logger.error(f"❌ User {user_id} not found in Firebase")
            return False
        
        # Update the active field
        doc_ref.update({'active': active})
        logger.info(f"✅ Updated user {user_id} status to {'active' if active else 'inactive'} in Firebase")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to toggle user {user_id} status in Firebase: {e}")
        return False

def delete_user(user_id: str) -> bool:
    """Delete user from Firebase"""
    if not firebase_service.is_available():
        logger.warning("🔄 Firebase not available, cannot delete user")
        return False
    
    try:
        # Delete user from Firestore
        doc_ref = firebase_service.db.collection('users').document(user_id)
        
        # Check if user exists
        doc = doc_ref.get()
        if not doc.exists:
            logger.error(f"❌ User {user_id} not found in Firebase")
            return False
        
        # Delete the document
        doc_ref.delete()
        logger.info(f"🗑️ Deleted user {user_id} from Firebase")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to delete user {user_id} from Firebase: {e}")
        return False

def get_firebase_app(app_id: str) -> Optional[Dict[str, Any]]:
    """Get specific app from Firebase 'apps' collection"""
    if not firebase_service.is_available():
        return None
    
    try:
        doc_ref = firebase_service.db.collection('apps').document(app_id)
        doc = doc_ref.get()
        
        if doc.exists:
            app_data = doc.to_dict()
            app_data['id'] = doc.id
            return app_data
        
        return None
        
    except Exception as e:
        logger.error(f"❌ Error getting Firebase app {app_id}: {e}")
        return None