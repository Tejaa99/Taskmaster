# backend/app.py
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_pymongo import PyMongo
from bson import ObjectId
import bcrypt
import jwt
from datetime import datetime, timedelta
from functools import wraps
import re
import os
import io
from config import Config

# ==================== NEW IMPORTS FOR ENHANCED FEATURES ====================
# Email notifications
from flask_mail import Mail, Message
from apscheduler.schedulers.background import BackgroundScheduler

# ==================== FIXED: File uploads with werkzeug compatibility ====================
# Instead of flask_uploads which has import issues, use direct werkzeug
from werkzeug.utils import secure_filename
from werkzeug.datastructures import FileStorage

# Export features
# import pandas as pd
# from reportlab.lib import colors
# from reportlab.lib.pagesizes import letter, A4
# from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
# from reportlab.lib.styles import getSampleStyleSheet

# ==================== INITIALIZE FLASK APP ====================
app = Flask(__name__)
app.config.from_object(Config)

# Initialize CORS - Allow all origins for development
CORS(app, origins="*", supports_credentials=True)

# ==================== INITIALIZE NEW SERVICES ====================

# Initialize Mail
mail = Mail()
mail.init_app(app)

# Initialize Scheduler for background jobs
scheduler = BackgroundScheduler()
scheduler.start()

# ==================== FIXED: File upload configuration without flask_uploads ====================
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xlsx'}

# Create uploads folder if it doesn't exist
# os.makedirs('uploads', exist_ok=True)

# ==================== PROFILE PHOTO UPLOAD CONFIGURATION (ADDED - DOESN'T AFFECT EXISTING) ====================
app.config['PROFILE_UPLOAD_FOLDER'] = 'profile_photos'
app.config['MAX_PROFILE_SIZE'] = 5 * 1024 * 1024  # 5MB max
ALLOWED_PROFILE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Create profile photos folder
os.makedirs('profile_photos', exist_ok=True)

# ==================== INITIALIZE MONGODB ====================
app.config["MONGO_URI"] = Config.MONGO_URI
mongo = PyMongo(app)
db = mongo.cx[Config.MONGO_DB]

# Collections
users_collection = db['users']
tasks_collection = db['tasks']

# ==================== CREATE INDEXES ====================
def create_indexes():
    """Create database indexes"""
    try:
        users_collection.create_index('email', unique=True)
        tasks_collection.create_index('userId')
        tasks_collection.create_index([('userId', 1), ('status', 1)])
        tasks_collection.create_index([('userId', 1), ('dueDate', 1)])
        print("✓ Database indexes created successfully")
    except Exception as e:
        print(f"Note: Indexes may already exist: {e}")

# Create indexes on startup
create_indexes()

# ==================== HELPER FUNCTIONS ====================

def validate_email(email):
    """Validate email format"""
    pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    return re.match(pattern, email) is not None

def validate_password(password):
    """Validate password strength"""
    return len(password) >= 6

def generate_token(user_id):
    """Generate JWT token"""
    payload = {
        'user_id': str(user_id),
        'exp': datetime.utcnow() + timedelta(hours=Config.JWT_EXPIRATION_HOURS),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm='HS256')

def verify_token(token):
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=['HS256'])
        return payload['user_id']
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def token_required(f):
    """Decorator to require valid token for routes"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Get token from header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'success': False, 'message': 'Token is missing!'}), 401
        
        user_id = verify_token(token)
        if not user_id:
            return jsonify({'success': False, 'message': 'Token is invalid or expired!'}), 401
        
        return f(user_id, *args, **kwargs)
    
    return decorated

def serialize_document(doc):
    """Convert MongoDB document to JSON serializable format"""
    if doc is None:
        return None
    
    doc['_id'] = str(doc['_id'])
    if 'userId' in doc and isinstance(doc['userId'], ObjectId):
        doc['userId'] = str(doc['userId'])
    
    # Convert datetime objects to string
    for key, value in doc.items():
        if isinstance(value, datetime):
            doc[key] = value.isoformat()
    
    return doc

def allowed_file(filename):
    """Check if file type is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def allowed_profile_photo(filename):
    """Check if profile photo type is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_PROFILE_EXTENSIONS

# ==================== FIXED: Custom file save function ====================
def save_uploaded_file(file):
    """Save uploaded file with secure filename"""
    filename = secure_filename(file.filename)
    # Add timestamp to prevent duplicate filenames
    name, ext = os.path.splitext(filename)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{name}_{timestamp}{ext}"
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(file_path)
    return filename

# ==================== EMAIL NOTIFICATION FUNCTIONS ====================

def send_email(recipient, subject, body):
    """Send email"""
    try:
        msg = Message(
            subject=subject,
            recipients=[recipient],
            body=body,
            sender=Config.MAIL_DEFAULT_SENDER
        )
        mail.send(msg)
        print(f"✓ Email sent to {recipient}")
        return True
    except Exception as e:
        print(f"✗ Email error: {e}")
        return False

def check_due_date_reminders():
    """Check for tasks due in 24 hours and send reminders"""
    print(f"🔔 Checking for due tasks at {datetime.now()}")
    
    # Calculate tomorrow's date
    tomorrow = datetime.now() + timedelta(days=1)
    tomorrow_start = datetime(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0, 0)
    tomorrow_end = datetime(tomorrow.year, tomorrow.month, tomorrow.day, 23, 59, 59)
    
    # Find tasks due tomorrow
    tasks = tasks_collection.find({
        'dueDate': {
            '$gte': tomorrow_start,
            '$lte': tomorrow_end
        },
        'status': {'$ne': 'completed'}
    })
    
    # Group tasks by user
    user_tasks = {}
    for task in tasks:
        user_id = str(task['userId'])
        if user_id not in user_tasks:
            user_tasks[user_id] = []
        user_tasks[user_id].append(task)
    
    # Send emails
    for user_id, tasks in user_tasks.items():
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        if user and 'email' in user:
            subject = "⏰ Task Reminder: Tasks Due Tomorrow"
            body = f"Hi {user['name']},\n\n"
            body += "You have the following tasks due tomorrow:\n\n"
            
            for task in tasks:
                body += f"• {task['title']} (Priority: {task['priority']})\n"
                if 'description' in task and task['description']:
                    body += f"  {task['description'][:100]}...\n"
            
            body += "\nComplete them before the deadline!\n"
            body += "Login to TaskMaster Pro to update your progress."
            
            send_email(user['email'], subject, body)

def send_weekly_summary():
    """Send weekly task summary to all users"""
    print(f"📊 Sending weekly summary at {datetime.now()}")
    
    users = users_collection.find()
    
    for user in users:
        # Get user's tasks
        tasks = list(tasks_collection.find({'userId': user['_id']}))
        
        if tasks:
            total = len(tasks)
            completed = len([t for t in tasks if t['status'] == 'completed'])
            pending = len([t for t in tasks if t['status'] == 'pending'])
            in_progress = len([t for t in tasks if t['status'] == 'in-progress'])
            
            subject = "📊 Your Weekly Task Summary"
            body = f"Hi {user['name']},\n\n"
            body += "Here's your task summary for this week:\n\n"
            body += f"📋 Total Tasks: {total}\n"
            body += f"✅ Completed: {completed}\n"
            body += f"⏳ Pending: {pending}\n"
            body += f"🔄 In Progress: {in_progress}\n\n"
            
            if pending > 0:
                body += "Tasks to focus on this week:\n"
                due_soon = [t for t in tasks if t['status'] != 'completed']
                for task in due_soon[:5]:
                    due_date = task['dueDate'].strftime('%Y-%m-%d') if hasattr(task['dueDate'], 'strftime') else str(task['dueDate'])
                    body += f"• {task['title']} (Due: {due_date})\n"
            
            body += "\nKeep up the great work!\n"
            body += "Login to TaskMaster Pro to manage your tasks."
            
            send_email(user['email'], subject, body)

# Schedule jobs
scheduler.add_job(
    func=check_due_date_reminders,
    trigger="cron",
    hour=8,
    minute=0,
    id="daily_reminders"
)

scheduler.add_job(
    func=send_weekly_summary,
    trigger="cron",
    day_of_week="mon",
    hour=9,
    minute=0,
    id="weekly_summary"
)

# ==================== EXISTING AUTHENTICATION ROUTES ====================
# (All your existing routes remain exactly as they were)

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()
        print(f"Registration attempt with data: {data}")
        
        # Validate required fields
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        if not data.get('name') or not data.get('email') or not data.get('password'):
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
        name = data['name'].strip()
        email = data['email'].strip().lower()
        password = data['password']
        
        # Validate email format
        if not validate_email(email):
            return jsonify({'success': False, 'message': 'Invalid email format'}), 400
        
        # Validate password strength
        if not validate_password(password):
            return jsonify({'success': False, 'message': 'Password must be at least 6 characters'}), 400
        
        # Check if user already exists
        if users_collection.find_one({'email': email}):
            return jsonify({'success': False, 'message': 'Email already registered'}), 409
        
        # Hash password
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
        
        # Create user document
        user = {
            'name': name,
            'email': email,
            'password': hashed_password,
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow()
        }
        
        # Insert user
        result = users_collection.insert_one(user)
        user_id = result.inserted_id
        
        # Generate token
        token = generate_token(user_id)
        
        # Return success response (excluding password)
        user_data = {
            '_id': str(user_id),
            'name': name,
            'email': email,
            'createdAt': user['createdAt'].isoformat()
        }
        
        print(f"User registered successfully: {email}")
        
        return jsonify({
            'success': True,
            'message': 'User registered successfully',
            'token': token,
            'user': user_data
        }), 201
        
    except Exception as e:
        print(f"Registration error: {str(e)}")
        return jsonify({'success': False, 'message': f'Internal server error: {str(e)}'}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login user"""
    try:
        data = request.get_json()
        print(f"Login attempt with data: {data}")
        
        # Validate required fields
        if not data or not data.get('email') or not data.get('password'):
            return jsonify({'success': False, 'message': 'Missing email or password'}), 400
        
        email = data['email'].strip().lower()
        password = data['password']
        
        # Find user
        user = users_collection.find_one({'email': email})
        
        if not user:
            print(f"User not found: {email}")
            return jsonify({'success': False, 'message': 'Invalid email or password'}), 401
        
        # Verify password
        if not bcrypt.checkpw(password.encode('utf-8'), user['password']):
            print(f"Invalid password for user: {email}")
            return jsonify({'success': False, 'message': 'Invalid email or password'}), 401
        
        # Generate token
        token = generate_token(user['_id'])
        
        # Return user data (excluding password)
        user_data = {
            '_id': str(user['_id']),
            'name': user['name'],
            'email': user['email'],
            'createdAt': user['createdAt'].isoformat() if 'createdAt' in user else None
        }
        
        print(f"User logged in successfully: {email}")
        
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'token': token,
            'user': user_data
        }), 200
        
    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({'success': False, 'message': f'Internal server error: {str(e)}'}), 500

@app.route('/api/auth/verify', methods=['GET'])
@token_required
def verify_token_route(user_id):
    """Verify if token is valid"""
    try:
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        
        user_data = {
            '_id': str(user['_id']),
            'name': user['name'],
            'email': user['email']
        }
        
        return jsonify({
            'success': True,
            'message': 'Token is valid',
            'user': user_data
        }), 200
        
    except Exception as e:
        print(f"Token verification error: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500

# ==================== EXISTING TASKS ROUTES ====================

@app.route('/api/tasks', methods=['GET'])
@token_required
def get_tasks(user_id):
    """Get all tasks for the authenticated user"""
    try:
        # Get query parameters for filtering
        status = request.args.get('status')
        priority = request.args.get('priority')
        category = request.args.get('category')
        
        # Build query
        query = {'userId': ObjectId(user_id)}
        
        if status:
            query['status'] = status
        if priority:
            query['priority'] = priority
        if category:
            query['category'] = category
        
        # Get tasks sorted by due date
        tasks = list(tasks_collection.find(query).sort('dueDate', 1))
        
        # Serialize tasks
        serialized_tasks = [serialize_document(task) for task in tasks]
        
        return jsonify({
            'success': True,
            'tasks': serialized_tasks,
            'count': len(serialized_tasks)
        }), 200
        
    except Exception as e:
        print(f"Get tasks error: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500

@app.route('/api/tasks/<task_id>', methods=['GET'])
@token_required
def get_task(user_id, task_id):
    """Get a single task by ID"""
    try:
        if not ObjectId.is_valid(task_id):
            return jsonify({'success': False, 'message': 'Invalid task ID'}), 400
        
        task = tasks_collection.find_one({
            '_id': ObjectId(task_id),
            'userId': ObjectId(user_id)
        })
        
        if not task:
            return jsonify({'success': False, 'message': 'Task not found'}), 404
        
        return jsonify({
            'success': True,
            'task': serialize_document(task)
        }), 200
        
    except Exception as e:
        print(f"Get task error: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500

@app.route('/api/tasks', methods=['POST'])
@token_required
def create_task(user_id):
    """Create a new task"""
    try:
        data = request.get_json()
        print(f"Creating task with data: {data}")
        
        # Validate required fields
        required_fields = ['title', 'dueDate', 'priority', 'category', 'status']
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400
        
        # Parse due date
        try:
            due_date = datetime.fromisoformat(data['dueDate'].replace('Z', '+00:00'))
        except:
            due_date = datetime.strptime(data['dueDate'], '%Y-%m-%d')
        
        # Create task document
        task = {
            'userId': ObjectId(user_id),
            'title': data['title'].strip(),
            'description': data.get('description', '').strip(),
            'dueDate': due_date,
            'priority': data['priority'],
            'category': data['category'],
            'status': data['status'],
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow(),
            # New fields for enhanced features
            'attachments': [],
            'sharedWith': [],
            'comments': [],
            'activity': []
        }
        
        # Insert task
        result = tasks_collection.insert_one(task)
        task_id = result.inserted_id
        
        # Get created task
        created_task = tasks_collection.find_one({'_id': task_id})
        
        print(f"Task created successfully with ID: {task_id}")
        
        return jsonify({
            'success': True,
            'message': 'Task created successfully',
            'task': serialize_document(created_task)
        }), 201
        
    except Exception as e:
        print(f"Create task error: {str(e)}")
        return jsonify({'success': False, 'message': f'Internal server error: {str(e)}'}), 500

@app.route('/api/tasks/<task_id>', methods=['PUT'])
@token_required
def update_task(user_id, task_id):
    """Update an existing task"""
    try:
        data = request.get_json()
        print(f"Updating task {task_id} with data: {data}")
        
        if not ObjectId.is_valid(task_id):
            return jsonify({'success': False, 'message': 'Invalid task ID'}), 400
        
        # Check if task exists and belongs to user
        existing_task = tasks_collection.find_one({
            '_id': ObjectId(task_id),
            'userId': ObjectId(user_id)
        })
        
        if not existing_task:
            return jsonify({'success': False, 'message': 'Task not found'}), 404
        
        # Prepare update data
        update_data = {
            'updatedAt': datetime.utcnow()
        }
        
        # Update only provided fields
        updatable_fields = ['title', 'description', 'priority', 'category', 'status']
        for field in updatable_fields:
            if field in data:
                update_data[field] = data[field].strip() if isinstance(data[field], str) else data[field]
        
        # Handle due date separately
        if 'dueDate' in data:
            try:
                update_data['dueDate'] = datetime.fromisoformat(data['dueDate'].replace('Z', '+00:00'))
            except:
                update_data['dueDate'] = datetime.strptime(data['dueDate'], '%Y-%m-%d')
        
        # Update task
        tasks_collection.update_one(
            {'_id': ObjectId(task_id)},
            {'$set': update_data}
        )
        
        # Get updated task
        updated_task = tasks_collection.find_one({'_id': ObjectId(task_id)})
        
        print(f"Task {task_id} updated successfully")
        
        return jsonify({
            'success': True,
            'message': 'Task updated successfully',
            'task': serialize_document(updated_task)
        }), 200
        
    except Exception as e:
        print(f"Update task error: {str(e)}")
        return jsonify({'success': False, 'message': f'Internal server error: {str(e)}'}), 500

@app.route('/api/tasks/<task_id>', methods=['DELETE'])
@token_required
def delete_task(user_id, task_id):
    """Delete a task"""
    try:
        print(f"Deleting task {task_id}")
        
        if not ObjectId.is_valid(task_id):
            return jsonify({'success': False, 'message': 'Invalid task ID'}), 400
        
        # Check if task exists and belongs to user
        existing_task = tasks_collection.find_one({
            '_id': ObjectId(task_id),
            'userId': ObjectId(user_id)
        })
        
        if not existing_task:
            return jsonify({'success': False, 'message': 'Task not found'}), 404
        
        # Delete task
        result = tasks_collection.delete_one({'_id': ObjectId(task_id)})
        
        if result.deleted_count > 0:
            print(f"Task {task_id} deleted successfully")
            return jsonify({
                'success': True,
                'message': 'Task deleted successfully'
            }), 200
        else:
            return jsonify({'success': False, 'message': 'Failed to delete task'}), 500
        
    except Exception as e:
        print(f"Delete task error: {str(e)}")
        return jsonify({'success': False, 'message': f'Internal server error: {str(e)}'}), 500

# ==================== EXISTING USER PROFILE ROUTE ====================

@app.route('/api/user/profile', methods=['GET'])
@token_required
def get_profile(user_id):
    """Get user profile with task statistics"""
    try:
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        
        # Get task statistics
        task_stats = {
            'total': tasks_collection.count_documents({'userId': ObjectId(user_id)}),
            'pending': tasks_collection.count_documents({'userId': ObjectId(user_id), 'status': 'pending'}),
            'inProgress': tasks_collection.count_documents({'userId': ObjectId(user_id), 'status': 'in-progress'}),
            'completed': tasks_collection.count_documents({'userId': ObjectId(user_id), 'status': 'completed'})
        }
        
        user_data = {
            '_id': str(user['_id']),
            'name': user['name'],
            'email': user['email'],
            'bio': user.get('bio', ''),
            'profilePhoto': user.get('profilePhoto', ''),
            'createdAt': user['createdAt'].isoformat() if 'createdAt' in user else None,
            'taskStats': task_stats
        }
        
        return jsonify({
            'success': True,
            'user': user_data
        }), 200
        
    except Exception as e:
        print(f"Get profile error: {str(e)}")
        return jsonify({'success': False, 'message': 'Internal server error'}), 500

# ==================== EXISTING TEST ROUTE ====================

@app.route('/api/test', methods=['GET'])
def test():
    """Test route to check if API is working"""
    return jsonify({
        'success': True,
        'message': 'API is working!',
        'timestamp': datetime.utcnow().isoformat()
    })

# ==================== NEW FEATURE 1: EMAIL NOTIFICATION ROUTES ====================

@app.route('/api/tasks/<task_id>/remind', methods=['POST'])
@token_required
def send_reminder(user_id, task_id):
    """Send manual reminder for a task"""
    try:
        if not ObjectId.is_valid(task_id):
            return jsonify({'success': False, 'message': 'Invalid task ID'}), 400
        
        task = tasks_collection.find_one({
            '_id': ObjectId(task_id),
            'userId': ObjectId(user_id)
        })
        
        if not task:
            return jsonify({'success': False, 'message': 'Task not found'}), 404
        
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        
        due_date = task['dueDate'].strftime('%Y-%m-%d') if hasattr(task['dueDate'], 'strftime') else str(task['dueDate'])
        
        subject = "🔔 Task Reminder"
        body = f"Hi {user['name']},\n\n"
        body += f"Reminder: Your task '{task['title']}' is due on {due_date}.\n\n"
        body += f"Description: {task.get('description', 'No description')}\n\n"
        body += "Don't forget to complete it!\n"
        body += "Login to TaskMaster Pro to update your progress."
        
        success = send_email(user['email'], subject, body)
        
        if success:
            return jsonify({'success': True, 'message': 'Reminder sent successfully'}), 200
        else:
            return jsonify({'success': False, 'message': 'Failed to send reminder'}), 500
            
    except Exception as e:
        print(f"Reminder error: {str(e)}")
        return jsonify({'success': False, 'message': f'Internal server error: {str(e)}'}), 500

# ==================== FIXED: NEW FEATURE 2: FILE ATTACHMENT ROUTES ====================

@app.route('/api/tasks/<task_id>/attachments', methods=['POST'])
@token_required
def upload_attachment(user_id, task_id):
    """Upload file attachment for task"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'success': False, 'message': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'success': False, 'message': 'File type not allowed'}), 400
        
        # Check task exists
        if not ObjectId.is_valid(task_id):
            return jsonify({'success': False, 'message': 'Invalid task ID'}), 400
        
        task = tasks_collection.find_one({
            '_id': ObjectId(task_id),
            'userId': ObjectId(user_id)
        })
        
        if not task:
            return jsonify({'success': False, 'message': 'Task not found'}), 404
        
        # Save file using custom function
        filename = save_uploaded_file(file)
        file_url = f'/uploads/{filename}'
        
        # Get file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        # Add to task attachments
        attachment = {
            'filename': file.filename,  # Original filename
            'saved_as': filename,       # Saved filename with timestamp
            'url': file_url,
            'uploaded_at': datetime.utcnow().isoformat(),
            'size': file_size
        }
        
        tasks_collection.update_one(
            {'_id': ObjectId(task_id)},
            {'$push': {'attachments': attachment}}
        )
        
        return jsonify({
            'success': True,
            'message': 'File uploaded successfully',
            'attachment': attachment
        }), 200
        
    except Exception as e:
        print(f"Upload error: {str(e)}")
        return jsonify({'success': False, 'message': f'Upload failed: {str(e)}'}), 500

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/tasks/<task_id>/attachments/<filename>', methods=['DELETE'])
@token_required
def delete_attachment(user_id, task_id, filename):
    """Delete attachment"""
    try:
        if not ObjectId.is_valid(task_id):
            return jsonify({'success': False, 'message': 'Invalid task ID'}), 400
        
        task = tasks_collection.find_one({
            '_id': ObjectId(task_id),
            'userId': ObjectId(user_id)
        })
        
        if not task:
            return jsonify({'success': False, 'message': 'Task not found'}), 404
        
        # Remove from database
        tasks_collection.update_one(
            {'_id': ObjectId(task_id)},
            {'$pull': {'attachments': {'saved_as': filename}}}
        )
        
        # Delete file
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        if os.path.exists(file_path):
            os.remove(file_path)
        
        return jsonify({'success': True, 'message': 'Attachment deleted'}), 200
        
    except Exception as e:
        print(f"Delete attachment error: {str(e)}")
        return jsonify({'success': False, 'message': f'Internal error: {str(e)}'}), 500

# ==================== NEW FEATURE 3: TEAM COLLABORATION ROUTES ====================

@app.route('/api/tasks/<task_id>/share', methods=['POST'])
@token_required
def share_task(user_id, task_id):
    """Share task with another user"""
    try:
        data = request.get_json()
        share_with_email = data.get('email')
        
        if not share_with_email:
            return jsonify({'success': False, 'message': 'Email required'}), 400
        
        # Find user to share with
        share_user = users_collection.find_one({'email': share_with_email})
        
        if not share_user:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        
        # Check if task exists
        if not ObjectId.is_valid(task_id):
            return jsonify({'success': False, 'message': 'Invalid task ID'}), 400
        
        task = tasks_collection.find_one({
            '_id': ObjectId(task_id),
            'userId': ObjectId(user_id)
        })
        
        if not task:
            return jsonify({'success': False, 'message': 'Task not found'}), 404
        
        # Add shared user
        tasks_collection.update_one(
            {'_id': ObjectId(task_id)},
            {'$addToSet': {'sharedWith': str(share_user['_id'])}}
        )
        
        # Add to activity log
        activity = {
            'userId': str(user_id),
            'action': 'shared',
            'targetUser': str(share_user['_id']),
            'timestamp': datetime.utcnow().isoformat()
        }
        
        tasks_collection.update_one(
            {'_id': ObjectId(task_id)},
            {'$push': {'activity': activity}}
        )
        
        return jsonify({'success': True, 'message': 'Task shared successfully'}), 200
        
    except Exception as e:
        print(f"Share error: {str(e)}")
        return jsonify({'success': False, 'message': f'Internal error: {str(e)}'}), 500

@app.route('/api/tasks/<task_id>/comments', methods=['POST'])
@token_required
def add_comment(user_id, task_id):
    """Add comment to task"""
    try:
        data = request.get_json()
        comment_text = data.get('comment')
        
        if not comment_text:
            return jsonify({'success': False, 'message': 'Comment required'}), 400
        
        # Check if task exists
        if not ObjectId.is_valid(task_id):
            return jsonify({'success': False, 'message': 'Invalid task ID'}), 400
        
        # Check if user has access to task
        task = tasks_collection.find_one({
            '$or': [
                {'_id': ObjectId(task_id), 'userId': ObjectId(user_id)},
                {'_id': ObjectId(task_id), 'sharedWith': str(user_id)}
            ]
        })
        
        if not task:
            return jsonify({'success': False, 'message': 'Task not found'}), 404
        
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        
        comment = {
            'userId': str(user_id),
            'userName': user['name'],
            'text': comment_text,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        tasks_collection.update_one(
            {'_id': ObjectId(task_id)},
            {'$push': {'comments': comment}}
        )
        
        return jsonify({'success': True, 'message': 'Comment added', 'comment': comment}), 200
        
    except Exception as e:
        print(f"Comment error: {str(e)}")
        return jsonify({'success': False, 'message': f'Internal error: {str(e)}'}), 500

@app.route('/api/tasks/shared', methods=['GET'])
@token_required
def get_shared_tasks(user_id):
    """Get tasks shared with user - SIMPLIFIED WORKING VERSION"""
    try:
        print("\n" + "="*50)
        print("🔍 SHARED TASKS DEBUG")
        print("="*50)
        print(f"👤 Looking for tasks shared with user ID: {user_id}")
        
        # DIRECT QUERY - Find tasks where sharedWith array contains this user ID
        # In MongoDB, this checks if the string is in the array
        tasks = list(tasks_collection.find({
            'sharedWith': user_id  # Direct string comparison
        }))
        
        print(f"📦 Found {len(tasks)} shared tasks")
        
        if len(tasks) == 0:
            print("❌ No tasks found with sharedWith containing:", user_id)
            
            # DEBUG: Show all tasks that have any sharedWith entries
            print("\n📋 Checking all tasks with sharedWith array:")
            all_shared = list(tasks_collection.find({
                'sharedWith': {'$exists': True, '$ne': []}
            }))
            for task in all_shared:
                print(f"  Task: {task.get('title')}")
                print(f"  sharedWith: {task.get('sharedWith')}")
            
            return jsonify({
                'success': True,
                'tasks': [],
                'count': 0
            }), 200
        
        # Process tasks
        serialized_tasks = []
        for task in tasks:
            print(f"\n📋 Processing: {task.get('title')}")
            print(f"  Attachments: {len(task.get('attachments', []))}")
            print(f"  Comments: {len(task.get('comments', []))}")
            
            # Get owner info
            owner = users_collection.find_one({'_id': task['userId']})
            owner_name = owner['name'] if owner else 'Unknown'
            
            serialized = serialize_document(task)
            serialized['sharedBy'] = owner_name
            serialized_tasks.append(serialized)
        
        print(f"\n✅ Returning {len(serialized_tasks)} tasks")
        
        return jsonify({
            'success': True,
            'tasks': serialized_tasks,
            'count': len(serialized_tasks)
        }), 200
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/tasks/<task_id>/activity', methods=['GET'])
@token_required
def get_task_activity(user_id, task_id):
    """Get activity log for task"""
    try:
        if not ObjectId.is_valid(task_id):
            return jsonify({'success': False, 'message': 'Invalid task ID'}), 400
        
        task = tasks_collection.find_one({
            '$or': [
                {'_id': ObjectId(task_id), 'userId': ObjectId(user_id)},
                {'_id': ObjectId(task_id), 'sharedWith': str(user_id)}
            ]
        })
        
        if not task:
            return jsonify({'success': False, 'message': 'Task not found'}), 404
        
        return jsonify({
            'success': True,
            'activity': task.get('activity', [])
        }), 200
        
    except Exception as e:
        print(f"Get activity error: {str(e)}")
        return jsonify({'success': False, 'message': f'Internal error: {str(e)}'}), 500

# ==================== NEW FEATURE 4: EXPORT ROUTES ====================

# @app.route('/api/export/csv', methods=['GET'])
# @token_required
# def export_csv(user_id):
#     """Export tasks to CSV"""
#     try:
#         tasks = list(tasks_collection.find({'userId': ObjectId(user_id)}))
        
#         # Prepare data for CSV
#         data = []
#         for task in tasks:
#             due_date = task['dueDate'].strftime('%Y-%m-%d') if hasattr(task['dueDate'], 'strftime') else str(task['dueDate'])
#             created_at = task['createdAt'].strftime('%Y-%m-%d') if hasattr(task['createdAt'], 'strftime') else str(task['createdAt'])
            
#             data.append({
#                 'Title': task['title'],
#                 'Description': task.get('description', ''),
#                 'Due Date': due_date,
#                 'Priority': task['priority'],
#                 'Category': task['category'],
#                 'Status': task['status'],
#                 'Created': created_at
#             })
        
#         df = pd.DataFrame(data)
        
#         # Create CSV
#         csv_data = df.to_csv(index=False)
        
#         response = app.response_class(
#             response=csv_data,
#             status=200,
#             mimetype='text/csv',
#             headers={'Content-Disposition': 'attachment; filename=tasks_export.csv'}
#         )
        
#         return response
        
#     except Exception as e:
#         print(f"Export error: {str(e)}")
#         return jsonify({'success': False, 'message': f'Export failed: {str(e)}'}), 500

# @app.route('/api/export/pdf', methods=['GET'])
# @token_required
# def export_pdf(user_id):
#     """Export tasks to PDF"""
#     try:
#         tasks = list(tasks_collection.find({'userId': ObjectId(user_id)}))
#         user = users_collection.find_one({'_id': ObjectId(user_id)})
        
#         # Create PDF buffer
#         buffer = io.BytesIO()
#         doc = SimpleDocTemplate(buffer, pagesize=A4)
#         elements = []
        
#         # Add title
#         styles = getSampleStyleSheet()
#         title = Paragraph(f"Task Report for {user['name']}", styles['Title'])
#         elements.append(title)
#         elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
#         elements.append(Paragraph(" ", styles['Normal']))
        
#         # Create table data
#         table_data = [['Title', 'Due Date', 'Priority', 'Status']]
#         for task in tasks:
#             due_date = task['dueDate'].strftime('%Y-%m-%d') if hasattr(task['dueDate'], 'strftime') else str(task['dueDate'])
#             table_data.append([
#                 task['title'][:30],
#                 due_date,
#                 task['priority'],
#                 task['status']
#             ])
        
#         # Create table
#         table = Table(table_data)
#         table.setStyle(TableStyle([
#             ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
#             ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
#             ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
#             ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
#             ('FONTSIZE', (0, 0), (-1, 0), 14),
#             ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
#             ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
#             ('GRID', (0, 0), (-1, -1), 1, colors.black)
#         ]))
        
#         elements.append(table)
        
#         # Build PDF
#         doc.build(elements)
        
#         pdf_data = buffer.getvalue()
#         buffer.close()
        
#         response = app.response_class(
#             response=pdf_data,
#             status=200,
#             mimetype='application/pdf',
#             headers={'Content-Disposition': 'attachment; filename=tasks_report.pdf'}
#         )
        
#         return response
        
#     except Exception as e:
#         print(f"PDF export error: {str(e)}")
#         return jsonify({'success': False, 'message': f'PDF export failed: {str(e)}'}), 500

# ==================== NEW FEATURE 5: DARK MODE PREFERENCE ====================

@app.route('/api/user/preferences', methods=['GET'])
@token_required
def get_preferences(user_id):
    """Get user preferences including theme"""
    try:
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        
        preferences = user.get('preferences', {'theme': 'light'})
        
        return jsonify({
            'success': True,
            'preferences': preferences
        }), 200
        
    except Exception as e:
        print(f"Get preferences error: {str(e)}")
        return jsonify({'success': False, 'message': f'Internal error: {str(e)}'}), 500

@app.route('/api/user/preferences', methods=['PUT'])
@token_required
def update_preferences(user_id):
    """Update user preferences including theme"""
    try:
        data = request.get_json()
        theme = data.get('theme')
        
        if theme not in ['light', 'dark']:
            return jsonify({'success': False, 'message': 'Invalid theme value'}), 400
        
        users_collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'preferences.theme': theme}}
        )
        
        return jsonify({
            'success': True,
            'message': 'Preferences updated successfully'
        }), 200
        
    except Exception as e:
        print(f"Update preferences error: {str(e)}")
        return jsonify({'success': False, 'message': f'Internal error: {str(e)}'}), 500

# ==================== NEW PROFILE FEATURES (ADDED - DOESN'T AFFECT EXISTING) ====================

@app.route('/api/user/photo', methods=['POST'])
@token_required
def upload_profile_photo(user_id):
    """Upload profile photo"""
    try:
        if 'photo' not in request.files:
            return jsonify({'success': False, 'message': 'No photo provided'}), 400
        
        file = request.files['photo']
        
        if file.filename == '':
            return jsonify({'success': False, 'message': 'No file selected'}), 400
        
        # Check file extension
        if not allowed_profile_photo(file.filename):
            return jsonify({'success': False, 'message': 'File type not allowed. Use PNG, JPG, JPEG, or GIF'}), 400
        
        # Save file with user ID as filename
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"profile_{user_id}.{ext}"
        file_path = os.path.join(app.config['PROFILE_UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # Update user document with photo path
        photo_url = f"/profile_photos/{filename}"
        users_collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'profilePhoto': photo_url}}
        )
        
        return jsonify({
            'success': True,
            'message': 'Profile photo uploaded successfully',
            'photoUrl': photo_url
        }), 200
        
    except Exception as e:
        print(f"Profile photo upload error: {str(e)}")
        return jsonify({'success': False, 'message': f'Upload failed: {str(e)}'}), 500

@app.route('/profile_photos/<filename>')
def get_profile_photo(filename):
    """Serve profile photos"""
    return send_from_directory(app.config['PROFILE_UPLOAD_FOLDER'], filename)

@app.route('/api/user/photo', methods=['DELETE'])
@token_required
def delete_profile_photo(user_id):
    """Delete profile photo"""
    try:
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        if user and 'profilePhoto' in user:
            # Extract filename from URL
            filename = user['profilePhoto'].split('/')[-1]
            file_path = os.path.join(app.config['PROFILE_UPLOAD_FOLDER'], filename)
            if os.path.exists(file_path):
                os.remove(file_path)
            
            # Remove from database
            users_collection.update_one(
                {'_id': ObjectId(user_id)},
                {'$unset': {'profilePhoto': ''}}
            )
        
        return jsonify({'success': True, 'message': 'Profile photo removed'}), 200
        
    except Exception as e:
        print(f"Profile photo delete error: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/user/profile', methods=['PUT'])
@token_required
def update_profile(user_id):
    """Update user profile information"""
    try:
        data = request.get_json()
        update_data = {}
        
        # Update name if provided
        if 'name' in data and data['name'].strip():
            update_data['name'] = data['name'].strip()
        
        # Update email if provided
        if 'email' in data and data['email'].strip():
            new_email = data['email'].strip().lower()
            if not validate_email(new_email):
                return jsonify({'success': False, 'message': 'Invalid email format'}), 400
            
            # Check if email is already taken
            existing = users_collection.find_one({
                'email': new_email,
                '_id': {'$ne': ObjectId(user_id)}
            })
            if existing:
                return jsonify({'success': False, 'message': 'Email already in use'}), 409
            
            update_data['email'] = new_email
        
        # Update bio if provided
        if 'bio' in data:
            update_data['bio'] = data['bio'].strip()[:200]  # Limit to 200 chars
        
        if update_data:
            update_data['updatedAt'] = datetime.utcnow()
            users_collection.update_one(
                {'_id': ObjectId(user_id)},
                {'$set': update_data}
            )
        
        # Get updated user
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        user_data = {
            '_id': str(user['_id']),
            'name': user['name'],
            'email': user['email'],
            'bio': user.get('bio', ''),
            'profilePhoto': user.get('profilePhoto', ''),
            'createdAt': user['createdAt'].isoformat() if 'createdAt' in user else None
        }
        
        return jsonify({
            'success': True,
            'message': 'Profile updated successfully',
            'user': user_data
        }), 200
        
    except Exception as e:
        print(f"Profile update error: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== ERROR HANDLERS ====================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'message': 'Resource not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'message': 'Internal server error'}), 500

# ==================== MAIN ENTRY POINT ====================

if __name__ == '__main__':
    print("\n" + "="*50)
    print("🚀 Starting TaskMaster Pro Backend Server")
    print("="*50)
    print(f"📡 Server will run on: http://localhost:{Config.PORT}")
    print(f"🗄️  MongoDB: {Config.MONGO_URI}{Config.MONGO_DB}")
    print(f"🔧 Debug mode: {Config.DEBUG}")
    print("\n✨ Enhanced Features Loaded:")
    print("   ✓ Email Notifications")
    print("   ✓ File Attachments (Fixed)")
    print("   ✓ Team Collaboration")
    print("   ✓ Export Reports (CSV/PDF)")
    print("   ✓ Dark Mode Support")
    print("   ✓ Profile Photos & Editing (NEW)")
    print("="*50 + "\n")
    
    app.run(debug=Config.DEBUG, port=Config.PORT, host='0.0.0.0')