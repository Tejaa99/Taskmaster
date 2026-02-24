# backend/services/email_service.py
from flask_mail import Mail, Message
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
import os
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import mongo
from config import Config

mail = Mail()
scheduler = BackgroundScheduler()

def init_email(app):
    """Initialize email service"""
    mail.init_app(app)
    
    # Start scheduler
    scheduler.start()
    
    # Schedule daily task reminder check at 8 AM
    scheduler.add_job(
        func=send_due_date_reminders,
        trigger="cron",
        hour=8,
        minute=0,
        id="daily_reminders"
    )
    
    # Schedule weekly summary every Monday at 9 AM
    scheduler.add_job(
        func=send_weekly_summary,
        trigger="cron",
        day_of_week="mon",
        hour=9,
        minute=0,
        id="weekly_summary"
    )

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

def send_due_date_reminders():
    """Send reminders for tasks due in 24 hours"""
    print(f"🔔 Checking for due tasks at {datetime.now()}")
    
    # Calculate tomorrow's date
    tomorrow = datetime.now() + timedelta(days=1)
    tomorrow_start = datetime(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0, 0)
    tomorrow_end = datetime(tomorrow.year, tomorrow.month, tomorrow.day, 23, 59, 59)
    
    # Find tasks due tomorrow
    db = mongo.cx[Config.MONGO_DB]
    tasks = db.tasks.find({
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
        user = db.users.find_one({'_id': user_id})
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
    
    db = mongo.cx[Config.MONGO_DB]
    users = db.users.find()
    
    for user in users:
        # Get user's tasks
        tasks = list(db.tasks.find({'userId': user['_id']}))
        
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
                for task in due_soon[:5]:  # Show top 5
                    body += f"• {task['title']} (Due: {task['dueDate'].strftime('%Y-%m-%d')})\n"
            
            body += "\nKeep up the great work!\n"
            body += "Login to TaskMaster Pro to manage your tasks."
            
            send_email(user['email'], subject, body)

def send_task_reminder(user_email, user_name, task_title, due_date):
    """Send reminder for a specific task"""
    subject = "🔔 Task Reminder"
    body = f"Hi {user_name},\n\n"
    body += f"Reminder: Your task '{task_title}' is due on {due_date}.\n\n"
    body += "Don't forget to complete it!\n"
    body += "Login to TaskMaster Pro to update your progress."
    
    return send_email(user_email, subject, body)