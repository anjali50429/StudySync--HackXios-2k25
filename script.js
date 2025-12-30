class StudyPlanner {
    constructor() {
        this.schedules = JSON.parse(localStorage.getItem('studySchedules')) || {};
        this.currentScheduleId = null;
        this.timerInterval = null;
        this.timerSeconds = 0;
        this.isTimerRunning = false;
        
        this.initializeEventListeners();
        this.loadScheduleDropdown();
        this.initializePomodoro();
    }

    initializeEventListeners() {
        // Schedule management
        document.getElementById('newScheduleBtn').addEventListener('click', () => this.showNewScheduleForm());
        document.getElementById('deleteScheduleBtn').addEventListener('click', () => this.deleteCurrentSchedule());
        document.getElementById('scheduleDropdown').addEventListener('change', (e) => this.loadSchedule(e.target.value));
        document.getElementById('editScheduleBtn').addEventListener('click', () => this.editCurrentSchedule());
        
        // Form handling
        document.getElementById('studyForm').addEventListener('submit', (e) => this.handleFormSubmit(e));
        document.getElementById('addSubjectBtn').addEventListener('click', () => this.addSubjectInput());
        
        // Pomodoro timer
        document.getElementById('startTimer').addEventListener('click', () => this.startTimer());
        document.getElementById('pauseTimer').addEventListener('click', () => this.pauseTimer());
        document.getElementById('resetTimer').addEventListener('click', () => this.resetTimer());
        document.getElementById('pomodoroMinutes').addEventListener('change', (e) => this.updateTimerDisplay(e.target.value));
    }

    showNewScheduleForm() {
        document.getElementById('scheduleForm').style.display = 'block';
        document.getElementById('studyPlan').style.display = 'none';
        this.clearForm();
        this.currentScheduleId = null;
        document.getElementById('scheduleDropdown').value = '';
        document.getElementById('deleteScheduleBtn').disabled = true;
    }

    clearForm() {
        document.getElementById('scheduleTitle').value = '';
        document.getElementById('dailyHours').value = '3';
        
        // Reset subjects to one empty input
        const container = document.getElementById('subjectsContainer');
        container.innerHTML = `
            <div class="subject-input">
                <input type="text" placeholder="Subject name" class="subject-name" required>
                <select class="difficulty-level">
                    <option value="1">Easy (1)</option>
                    <option value="2" selected>Medium (2)</option>
                    <option value="3">Hard (3)</option>
                </select>
                <button type="button" class="btn btn-remove" onclick="removeSubject(this)">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }

    addSubjectInput() {
        const container = document.getElementById('subjectsContainer');
        const subjectDiv = document.createElement('div');
        subjectDiv.className = 'subject-input';
        subjectDiv.innerHTML = `
            <input type="text" placeholder="Subject name" class="subject-name" required>
            <select class="difficulty-level">
                <option value="1">Easy (1)</option>
                <option value="2" selected>Medium (2)</option>
                <option value="3">Hard (3)</option>
            </select>
            <button type="button" class="btn btn-remove" onclick="removeSubject(this)">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(subjectDiv);
    }

    handleFormSubmit(e) {
        e.preventDefault();
        
        const title = document.getElementById('scheduleTitle').value.trim();
        const dailyHours = parseInt(document.getElementById('dailyHours').value);
        const examDate = document.getElementById('examDate').value;
        
        if (!title) {
            alert('Please enter a schedule title');
            return;
        }

        if (!examDate) {
            alert('Please select an exam date');
            return;
        }

        const subjects = this.getSubjectsFromForm();
        if (subjects.length === 0) {
            alert('Please add at least one subject');
            return;
        }

        // Calculate days until exam
        const today = new Date();
        const exam = new Date(examDate);
        const daysUntilExam = Math.ceil((exam - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExam <= 0) {
            alert('Please select a future exam date');
            return;
        }

        const scheduleId = this.currentScheduleId || Date.now().toString();
        const schedule = {
            id: scheduleId,
            title: title,
            dailyHours: dailyHours,
            examDate: examDate,
            daysUntilExam: daysUntilExam,
            subjects: subjects,
            createdAt: new Date().toISOString(),
            tasks: this.generateStudyPlan(subjects, dailyHours, daysUntilExam)
        };

        this.schedules[scheduleId] = schedule;
        this.saveSchedules();
        this.loadScheduleDropdown();
        this.displaySchedule(schedule);
        this.currentScheduleId = scheduleId;
        
        document.getElementById('scheduleForm').style.display = 'none';
        document.getElementById('scheduleDropdown').value = scheduleId;
        document.getElementById('deleteScheduleBtn').disabled = false;
    }

    getSubjectsFromForm() {
        const subjectInputs = document.querySelectorAll('.subject-input');
        const subjects = [];
        
        subjectInputs.forEach(input => {
            const name = input.querySelector('.subject-name').value.trim();
            const difficulty = parseInt(input.querySelector('.difficulty-level').value);
            
            if (name) {
                subjects.push({ name, difficulty });
            }
        });
        
        return subjects;
    }

    generateStudyPlan(subjects, dailyHours, daysUntilExam) {
        const tasks = [];
        const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        
        // Calculate priority scores (difficulty × days until exam)
        const subjectsWithPriority = subjects.map(subject => ({
            ...subject,
            priorityScore: subject.difficulty * daysUntilExam,
            difficultyName: this.getDifficultyName(subject.difficulty)
        }));
        
        // Sort subjects by priority score (highest first)
        subjectsWithPriority.sort((a, b) => b.priorityScore - a.priorityScore);
        
        // Calculate time allocation based on priority scores
        const totalPriorityScore = subjectsWithPriority.reduce((sum, subject) => sum + subject.priorityScore, 0);
        
        // Generate tasks for each day
        daysOfWeek.forEach(day => {
            let remainingHours = dailyHours;
            
            subjectsWithPriority.forEach((subject, index) => {
                if (remainingHours <= 0) return;
                
                // Calculate hours based on priority, ensuring minimum 1 hour
                let hoursForSubject;
                if (index === subjectsWithPriority.length - 1) {
                    // Last subject gets remaining hours (minimum 1)
                    hoursForSubject = Math.max(1, remainingHours);
                } else {
                    const proportionalHours = (subject.priorityScore / totalPriorityScore) * dailyHours;
                    hoursForSubject = Math.max(1, Math.round(proportionalHours));
                    hoursForSubject = Math.min(hoursForSubject, remainingHours);
                }
                
                tasks.push({
                    id: Date.now() + Math.random(),
                    day: day,
                    subject: subject.name,
                    difficulty: subject.difficulty,
                    difficultyName: subject.difficultyName,
                    priorityScore: subject.priorityScore,
                    duration: hoursForSubject,
                    completed: false,
                    rescheduled: false
                });
                
                remainingHours -= hoursForSubject;
            });
        });
        
        // Sort tasks by day and priority score within each day
        tasks.sort((a, b) => {
            const dayOrder = daysOfWeek.indexOf(a.day) - daysOfWeek.indexOf(b.day);
            if (dayOrder !== 0) return dayOrder;
            return b.priorityScore - a.priorityScore; // Higher priority first
        });
        
        return tasks;
    }

    getDifficultyName(difficulty) {
        switch(difficulty) {
            case 1: return 'easy';
            case 2: return 'medium';
            case 3: return 'hard';
            default: return 'medium';
        }
    }

    displaySchedule(schedule) {
        document.getElementById('studyPlan').style.display = 'block';
        document.getElementById('planTitle').textContent = `${schedule.title} (${schedule.daysUntilExam} days until exam)`;
        
        const planContent = document.getElementById('planContent');
        const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        
        planContent.innerHTML = '';
        
        // Calculate overall progress
        const totalTasks = schedule.tasks.length;
        const completedTasks = schedule.tasks.filter(task => task.completed).length;
        const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        // Add overall progress bar
        const overallProgressDiv = document.createElement('div');
        overallProgressDiv.className = 'overall-progress';
        overallProgressDiv.innerHTML = `
            <h3>Overall Plan Progress</h3>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${overallProgress}%"></div>
            </div>
            <div class="progress-text">${completedTasks}/${totalTasks} tasks completed (${overallProgress}%)</div>
            ${overallProgress === 100 ? '<div class="achievement-badge">🎉 Plan Completed! Great Job!</div>' : ''}
        `;
        planContent.appendChild(overallProgressDiv);
        
        daysOfWeek.forEach(day => {
            const dayTasks = schedule.tasks.filter(task => task.day === day);
            if (dayTasks.length === 0) return;
            
            const dayDiv = document.createElement('div');
            dayDiv.className = 'day-schedule';
            
            // Calculate daily progress
            const dayCompletedTasks = dayTasks.filter(task => task.completed).length;
            const dayProgress = dayTasks.length > 0 ? Math.round((dayCompletedTasks / dayTasks.length) * 100) : 0;
            
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.innerHTML = `
                <div class="day-title">${day}</div>
                <div class="day-progress">
                    <div class="progress-bar-small">
                        <div class="progress-fill" style="width: ${dayProgress}%"></div>
                    </div>
                    <span class="progress-text-small">${dayCompletedTasks}/${dayTasks.length} (${dayProgress}%)</span>
                    ${dayProgress === 100 ? '<span class="day-achievement">✅ Day Complete!</span>' : ''}
                </div>
            `;
            dayDiv.appendChild(dayHeader);
            
            dayTasks.forEach(task => {
                const taskDiv = document.createElement('div');
                taskDiv.className = `task-item ${task.completed ? 'completed' : ''}`;
                
                taskDiv.innerHTML = `
                    <div class="task-info">
                        <div class="task-subject">${task.subject}</div>
                        <div class="task-time">${task.duration} hour${task.duration > 1 ? 's' : ''}</div>
                        <div class="task-priority">Priority Score: ${task.priorityScore}</div>
                    </div>
                    <div class="task-controls">
                        <span class="task-difficulty difficulty-${task.difficultyName}">${task.difficultyName} (${task.difficulty})</span>
                        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} 
                               onchange="studyPlanner.toggleTask('${task.id}')">
                        ${!task.completed ? `<button class="btn btn-secondary" onclick="studyPlanner.rescheduleTask('${task.id}')">
                            <i class="fas fa-calendar-alt"></i> Reschedule
                        </button>` : ''}
                    </div>
                `;
                
                dayDiv.appendChild(taskDiv);
            });
            
            planContent.appendChild(dayDiv);
        });
    }

    toggleTask(taskId) {
        if (!this.currentScheduleId) return;
        
        const schedule = this.schedules[this.currentScheduleId];
        const task = schedule.tasks.find(t => t.id == taskId);
        
        if (task) {
            task.completed = !task.completed;
            this.saveSchedules();
            this.displaySchedule(schedule);
        }
    }

    rescheduleTask(taskId) {
        if (!this.currentScheduleId) return;
        
        const schedule = this.schedules[this.currentScheduleId];
        const task = schedule.tasks.find(t => t.id == taskId);
        
        if (task) {
            const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            const currentDayIndex = daysOfWeek.indexOf(task.day);
            const nextDayIndex = (currentDayIndex + 1) % daysOfWeek.length;
            
            task.day = daysOfWeek[nextDayIndex];
            task.rescheduled = true;
            
            this.saveSchedules();
            this.displaySchedule(schedule);
            
            alert(`Task "${task.subject}" has been rescheduled to ${task.day}`);
        }
    }

    loadScheduleDropdown() {
        const dropdown = document.getElementById('scheduleDropdown');
        dropdown.innerHTML = '<option value="">Select a schedule...</option>';
        
        Object.values(this.schedules).forEach(schedule => {
            const option = document.createElement('option');
            option.value = schedule.id;
            option.textContent = schedule.title;
            dropdown.appendChild(option);
        });
    }

    loadSchedule(scheduleId) {
        if (!scheduleId) {
            document.getElementById('studyPlan').style.display = 'none';
            document.getElementById('deleteScheduleBtn').disabled = true;
            this.currentScheduleId = null;
            return;
        }
        
        const schedule = this.schedules[scheduleId];
        if (schedule) {
            this.currentScheduleId = scheduleId;
            this.displaySchedule(schedule);
            document.getElementById('scheduleForm').style.display = 'none';
            document.getElementById('deleteScheduleBtn').disabled = false;
        }
    }

    editCurrentSchedule() {
        if (!this.currentScheduleId) return;
        
        const schedule = this.schedules[this.currentScheduleId];
        
        // Populate form with current schedule data
        document.getElementById('scheduleTitle').value = schedule.title;
        document.getElementById('dailyHours').value = schedule.dailyHours;
        document.getElementById('examDate').value = schedule.examDate;
        
        // Clear and populate subjects
        const container = document.getElementById('subjectsContainer');
        container.innerHTML = '';
        
        schedule.subjects.forEach(subject => {
            const subjectDiv = document.createElement('div');
            subjectDiv.className = 'subject-input';
            subjectDiv.innerHTML = `
                <input type="text" placeholder="Subject name" class="subject-name" value="${subject.name}" required>
                <select class="difficulty-level">
                    <option value="1" ${subject.difficulty === 1 ? 'selected' : ''}>Easy (1)</option>
                    <option value="2" ${subject.difficulty === 2 ? 'selected' : ''}>Medium (2)</option>
                    <option value="3" ${subject.difficulty === 3 ? 'selected' : ''}>Hard (3)</option>
                </select>
                <button type="button" class="btn btn-remove" onclick="removeSubject(this)">
                    <i class="fas fa-times"></i>
                </button>
            `;
            container.appendChild(subjectDiv);
        });
        
        document.getElementById('scheduleForm').style.display = 'block';
        document.getElementById('studyPlan').style.display = 'none';
    }

    deleteCurrentSchedule() {
        if (!this.currentScheduleId) return;
        
        const schedule = this.schedules[this.currentScheduleId];
        if (confirm(`Are you sure you want to delete "${schedule.title}"?`)) {
            delete this.schedules[this.currentScheduleId];
            this.saveSchedules();
            this.loadScheduleDropdown();
            
            document.getElementById('scheduleDropdown').value = '';
            document.getElementById('studyPlan').style.display = 'none';
            document.getElementById('deleteScheduleBtn').disabled = true;
            this.currentScheduleId = null;
        }
    }

    saveSchedules() {
        localStorage.setItem('studySchedules', JSON.stringify(this.schedules));
    }

    // Pomodoro Timer Methods
    initializePomodoro() {
        this.updateTimerDisplay(25);
    }

    updateTimerDisplay(minutes) {
        this.timerSeconds = minutes * 60;
        const display = document.getElementById('timerDisplay');
        const mins = Math.floor(this.timerSeconds / 60);
        const secs = this.timerSeconds % 60;
        display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    startTimer() {
        if (this.isTimerRunning) return;
        
        const minutes = parseInt(document.getElementById('pomodoroMinutes').value);
        if (!this.timerSeconds) {
            this.timerSeconds = minutes * 60;
        }
        
        this.isTimerRunning = true;
        document.getElementById('startTimer').disabled = true;
        document.getElementById('pauseTimer').disabled = false;
        
        this.timerInterval = setInterval(() => {
            this.timerSeconds--;
            
            const display = document.getElementById('timerDisplay');
            const mins = Math.floor(this.timerSeconds / 60);
            const secs = this.timerSeconds % 60;
            display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            
            if (this.timerSeconds <= 0) {
                this.timerComplete();
            }
        }, 1000);
    }

    pauseTimer() {
        if (!this.isTimerRunning) return;
        
        clearInterval(this.timerInterval);
        this.isTimerRunning = false;
        document.getElementById('startTimer').disabled = false;
        document.getElementById('pauseTimer').disabled = true;
    }

    resetTimer() {
        clearInterval(this.timerInterval);
        this.isTimerRunning = false;
        const minutes = parseInt(document.getElementById('pomodoroMinutes').value);
        this.updateTimerDisplay(minutes);
        
        document.getElementById('startTimer').disabled = false;
        document.getElementById('pauseTimer').disabled = true;
    }

    timerComplete() {
        clearInterval(this.timerInterval);
        this.isTimerRunning = false;
        
        document.getElementById('startTimer').disabled = false;
        document.getElementById('pauseTimer').disabled = true;
        
        // Play notification sound (if browser supports it)
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Pomodoro Complete!', {
                body: 'Time for a break!',
                icon: '/favicon.ico'
            });
        } else {
            alert('Pomodoro Complete! Time for a break!');
        }
        
        const minutes = parseInt(document.getElementById('pomodoroMinutes').value);
        this.updateTimerDisplay(minutes);
    }
}

// Global functions for inline event handlers
function removeSubject(button) {
    const container = document.getElementById('subjectsContainer');
    if (container.children.length > 1) {
        button.parentElement.remove();
    }
}

// Initialize the application
let studyPlanner;
document.addEventListener('DOMContentLoaded', () => {
    studyPlanner = new StudyPlanner();
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});