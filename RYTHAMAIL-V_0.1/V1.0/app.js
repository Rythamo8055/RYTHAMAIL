class EmailService {
    constructor() {
        this.baseUrl = 'https://www.1secmail.com/api/v1/';
        this.domains = ['1secmail.com', '1secmail.org', '1secmail.net'];
        this.activeEmails = new Map();
        this.deviceId = this.getOrCreateDeviceId();
        this.loadFromStorage();
        this.cleanExpiredEmails();
    }

    getOrCreateDeviceId() {
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('deviceId', deviceId);
        }
        return deviceId;
    }

    // Load active emails from localStorage
    loadFromStorage() {
        try {
            // Load from localStorage
            const data = localStorage.getItem(`emailHistory_${this.deviceId}`);
            if (data) {
                const parsed = JSON.parse(data);
                this.activeEmails = new Map(parsed);
                
                // Clean up expired emails
                const now = Date.now();
                let hasExpired = false;
                
                for (const [email, expiry] of this.activeEmails.entries()) {
                    if (now > expiry) {
                        this.activeEmails.delete(email);
                        hasExpired = true;
                    }
                }
                
                if (hasExpired) {
                    this.saveToStorage();
                }
            }
        } catch (error) {
            console.error('Error loading email history:', error);
            this.activeEmails = new Map();
        }
    }

    // Save active emails to localStorage
    saveToStorage() {
        try {
            const data = Array.from(this.activeEmails.entries());
            localStorage.setItem(`emailHistory_${this.deviceId}`, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving email history:', error);
        }
    }

    // Clean expired emails
    cleanExpiredEmails() {
        const now = Date.now();
        let hasExpired = false;

        for (const [email, expiry] of this.activeEmails.entries()) {
            if (now > expiry) {
                this.activeEmails.delete(email);
                hasExpired = true;
            }
        }

        if (hasExpired) {
            this.saveToStorage();
        }
    }

    // Generate random string for email username
    generateRandomString(length = 12) {
        const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * charset.length);
            result += charset[randomIndex];
        }
        return result;
    }

    // Generate new email address
    async generateEmail(duration) {
        try {
            // Fetch random email from 1secmail API
            const response = await fetch(`${this.baseUrl}?action=genRandomMailbox&count=1`);
            if (!response.ok) {
                throw new Error('Failed to generate email from API');
            }
            
            const [email] = await response.json();
            if (!email) {
                throw new Error('No email received from API');
            }

            console.log('Generated email:', email);
            
            // Set expiration time
            const expiry = Date.now() + duration;
            this.activeEmails.set(email, expiry);
            this.saveToStorage();
            
            return email;
        } catch (error) {
            console.error('Error generating email:', error);
            throw error;
        }
    }

    // Delete email
    deleteEmail(email) {
        try {
            const deleted = this.activeEmails.delete(email);
            if (deleted) {
                this.saveToStorage();
            }
            return deleted;
        } catch (error) {
            console.error('Error deleting email:', error);
            return false;
        }
    }

    // Check mail for specific email
    async checkMail(email) {
        try {
            if (!email || !this.activeEmails.has(email)) {
                throw new Error('Invalid or expired email');
            }

            const [login, domain] = email.split('@');
            const url = `${this.baseUrl}?action=getMessages&login=${login}&domain=${domain}`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch messages');
            }

            const messages = await response.json();
            return messages;

        } catch (error) {
            console.error('Error checking mail:', error);
            throw error;
        }
    }

    // Read specific message
    async readMessage(email, messageId) {
        try {
            if (!email || !this.activeEmails.has(email)) {
                throw new Error('Invalid or expired email');
            }

            const [login, domain] = email.split('@');
            const response = await fetch(
                `${this.baseUrl}?action=readMessage&login=${login}&domain=${domain}&id=${messageId}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch message content');
            }

            const messageContent = await response.json();
            return messageContent;

        } catch (error) {
            console.error('Error reading message:', error);
            throw error;
        }
    }

    // Download attachment
    async downloadAttachment(email, messageId, filename) {
        try {
            if (!email || !this.activeEmails.has(email)) {
                throw new Error('Invalid or expired email');
            }

            const [login, domain] = email.split('@');
            const response = await fetch(
                `${this.baseUrl}?action=download&login=${login}&domain=${domain}&id=${messageId}&file=${filename}`
            );

            if (!response.ok) {
                throw new Error('Failed to download attachment');
            }

            return response.blob();

        } catch (error) {
            console.error('Error downloading attachment:', error);
            throw error;
        }
    }

    // Get time until expiration
    getTimeUntilExpiration(email) {
        const expiry = this.activeEmails.get(email);
        if (!expiry) return null;
        
        const remaining = expiry - Date.now();
        return remaining > 0 ? remaining : null;
    }

    // Format remaining time
    formatRemainingTime(milliseconds) {
        if (!milliseconds || milliseconds <= 0) return 'Expired';

        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    clearHistory() {
        this.activeEmails.clear();
        localStorage.removeItem(`emailHistory_${this.deviceId}`);
    }

    async generateAPIKey() {
        const key = this.generateRandomString(32);
        const expiry = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
        localStorage.setItem('api_key', JSON.stringify({ key, expiry }));
        return key;
    }

    async setupWebhook(url) {
        // Store webhook URL for email notifications
        localStorage.setItem('webhook_url', url);
        return true;
    }

    async exportToCalendar(email, expiry) {
        const event = {
            title: `Temporary Email Expiration: ${email}`,
            start: new Date(expiry).toISOString(),
            description: `Your temporary email ${email} will expire at this time.`
        };

        const icsData = this.generateICSFile(event);
        const blob = new Blob([icsData], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'email-expiration.ics';
        a.click();
        
        URL.revokeObjectURL(url);
    }
}

class EmailApp {
    constructor() {
        this.emailService = new EmailService();
        this.currentEmail = null;
        this.initializeEventListeners();
        this.startAutoRefresh();
        
        // Initialize email history on startup
        this.updateEmailList();
        
        // Add expiration indicator update
        setInterval(() => {
            this.updateExpirationIndicator();
            this.updateEmailList(); // Regularly update the list to reflect expirations
        }, 1000);
        
        // Add new properties
        this.lastChecked = null;
        this.messageCount = 0;
        this.isChecking = false;
        
        // Add new properties
        this.filters = {
            status: 'all', // all, active, expired
            search: ''
        };
        
        // Add to existing properties
        this.initializeFilters();
    }

    initializeFilters() {
        const searchInput = document.createElement('input');
        searchInput.type = 'search';
        searchInput.placeholder = 'Search emails...';
        searchInput.className = 'search-input';
        searchInput.addEventListener('input', (e) => {
            this.filters.search = e.target.value.toLowerCase();
            this.updateEmailList();
        });

        const filterButtons = `
            <button class="filter-btn active" data-filter="all">All</button>
            <button class="filter-btn" data-filter="active">Active</button>
            <button class="filter-btn" data-filter="expired">Expired</button>
        `;

        const filtersDiv = document.createElement('div');
        filtersDiv.className = 'history-filters';
        filtersDiv.innerHTML = filterButtons;
        filtersDiv.prepend(searchInput);

        const historyCard = document.querySelector('.card:last-child');
        historyCard.insertBefore(filtersDiv, historyCard.firstChild.nextSibling);

        filtersDiv.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                this.filters.status = e.target.dataset.filter;
                document.querySelectorAll('.filter-btn').forEach(btn => 
                    btn.classList.toggle('active', btn === e.target));
                this.updateEmailList();
            }
        });
    }

    // Add auto-refresh functionality
    startAutoRefresh() {
        // Check messages every 15 seconds
        setInterval(() => {
            if (this.currentEmail) {
                this.checkMessages(this.currentEmail);
                this.updateExpirationIndicator();
            }
        }, 15000);
    }

    // Add email generation methods
    async generateEmailWithDuration(duration) {
        try {
            const email = await this.emailService.generateEmail(duration);
            this.currentEmail = email;
            
            const emailDisplay = document.getElementById('emailDisplay');
            if (emailDisplay) {
                emailDisplay.value = email;
            }
            
            this.updateEmailList();
            this.hideExpirationDialog();
            this.showToast('Email generated successfully');
            this.checkMessages(email);
            
        } catch (error) {
            console.error('Error generating email:', error);
            this.showToast('Failed to generate email', 'error');
        }
    }

    // Add email list update method
    updateEmailList() {
        const emailHistory = document.getElementById('emailHistory');
        if (!emailHistory) return;

        const activeEmails = Array.from(this.emailService.activeEmails.entries());
        
        if (activeEmails.length === 0) {
            emailHistory.innerHTML = `
                <div class="no-history">
                    <p>No email history available</p>
                    <button class="btn primary" onclick="app.showExpirationDialog()">
                        Generate Your First Email
                    </button>
                </div>
            `;
            return;
        }

        // Sort emails by expiry time (newest first)
        activeEmails.sort((a, b) => b[1] - a[1]);

        const now = Date.now();
        emailHistory.innerHTML = activeEmails.map(([email, expiry]) => {
            const isExpired = now > expiry;
            const timeRemaining = expiry - now;
            const expiryStatus = isExpired ? 'expired' : 'active';
            
            return `
                <div class="email-cell ${this.currentEmail === email ? 'active' : ''}" 
                     data-email="${email}">
                    <div class="email-info">
                        <div class="email-address">${email}</div>
                        <div class="expiry-time">
                            <span class="expiry-badge ${expiryStatus}">
                                ${isExpired ? 'Expired' : 'Active'}
                            </span>
                            ${isExpired ? 
                                'Expired' : 
                                this.emailService.formatRemainingTime(timeRemaining)
                            }
                        </div>
                    </div>
                    <div class="email-actions" onclick="event.stopPropagation()">
                        <button class="btn small" onclick="app.copyEmail('${email}')">
                            Copy
                        </button>
                        <button class="btn danger small" onclick="app.deleteEmail('${email}')">
                            Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    formatTimeRemaining(ms) {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `${days} day${days !== 1 ? 's' : ''} remaining`;
        }
        
        if (hours > 0) {
            return `${hours}h ${minutes}m remaining`;
        }
        
        return `${minutes}m remaining`;
    }

    // Add attachment download method
    async downloadAttachment(email, messageId, filename) {
        try {
            const [login, domain] = email.split('@');
            const response = await fetch(
                `${this.emailService.baseUrl}?action=download&login=${login}&domain=${domain}&id=${messageId}&file=${filename}`
            );
            
            if (!response.ok) {
                throw new Error('Failed to download attachment');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            this.showToast('Download started');
            
        } catch (error) {
            console.error('Error downloading attachment:', error);
            this.showToast('Failed to download attachment', 'error');
        }
    }

    // Add email service helper methods
    generateCustomEmail(value, unit) {
        if (!value || value <= 0) {
            this.showToast('Please enter a valid duration', 'error');
            return;
        }

        const multipliers = {
            'hours': 60 * 60 * 1000,
            'days': 24 * 60 * 60 * 1000,
            'weeks': 7 * 24 * 60 * 60 * 1000,
            'months': 30 * 24 * 60 * 60 * 1000
        };

        const duration = value * multipliers[unit];
        this.generateEmailWithDuration(duration);
        this.hideExpirationDialog();
    }

    initializeEventListeners() {
        // Generate email button
        const generateEmailBtn = document.getElementById('generateEmail');
        const quickDuration = document.getElementById('quickDuration');
        
        if (generateEmailBtn && quickDuration) {
            generateEmailBtn.addEventListener('click', () => {
                const duration = quickDuration.value;
                
                if (duration === 'custom') {
                    this.showExpirationDialog();
                    return;
                }
                
                const durations = {
                    '1hour': 60 * 60 * 1000,
                    '1day': 24 * 60 * 60 * 1000,
                    '1week': 7 * 24 * 60 * 60 * 1000,
                    '2weeks': 14 * 24 * 60 * 60 * 1000
                };
                
                this.generateEmailWithDuration(durations[duration]);
            });
        }
        
        // Copy button
        const copyBtn = document.getElementById('copyBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const emailDisplay = document.getElementById('emailDisplay');
                if (emailDisplay && emailDisplay.value) {
                    this.copyEmail(emailDisplay.value);
                }
            });
        }

        // Check mail button
        const checkMailBtn = document.getElementById('checkMailBtn');
        if (checkMailBtn) {
            checkMailBtn.addEventListener('click', () => {
                if (this.currentEmail) {
                    this.checkMessages(this.currentEmail);
                }
            });
        }

        // Duration selection options
        document.querySelectorAll('.option').forEach(option => {
            option.addEventListener('click', (e) => {
                document.querySelectorAll('.option').forEach(opt => 
                    opt.classList.remove('selected'));
                e.target.classList.add('selected');
                
                const customTimeInput = document.getElementById('customTimeInput');
                if (customTimeInput) {
                    customTimeInput.style.display = 
                        e.target.dataset.duration === 'custom' ? 'block' : 'none';
                }
            });
        });

        // Confirm duration button
        const confirmDurationBtn = document.getElementById('confirmDuration');
        if (confirmDurationBtn) {
            confirmDurationBtn.addEventListener('click', () => {
                const selectedOption = document.querySelector('.option.selected');
                if (!selectedOption) {
                    this.showToast('Please select a duration', 'error');
                    return;
                }

                const duration = selectedOption.dataset.duration;
                if (duration === 'custom') {
                    const value = parseInt(document.getElementById('customValue').value);
                    const unit = document.getElementById('customUnit').value;
                    this.generateCustomEmail(value, unit);
                } else {
                    const durations = {
                        '1hour': 60 * 60 * 1000,
                        '1day': 24 * 60 * 60 * 1000,
                        '1week': 7 * 24 * 60 * 60 * 1000,
                        '2weeks': 14 * 24 * 60 * 60 * 1000
                    };
                    this.generateEmailWithDuration(durations[duration]);
                }
            });
        }

        // Close dialog buttons
        ['closeDialog', 'cancelDuration'].forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', () => this.hideExpirationDialog());
            }
        });

        // Clear all button
        const clearAllBtn = document.getElementById('clearAllBtn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.emailService.activeEmails.clear();
                this.emailService.saveToStorage();
                this.updateEmailList();
                this.showToast('Email history cleared');
            });
        }

        // Close modals when clicking outside
        document.querySelectorAll('.expiration-dialog, .email-modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Email history click handler
        document.getElementById('emailHistory').addEventListener('click', (e) => {
            const emailCell = e.target.closest('.email-cell');
            if (emailCell && !e.target.closest('.email-actions')) {
                const email = emailCell.dataset.email;
                if (email) {
                    this.currentEmail = email;
                    const emailDisplay = document.getElementById('emailDisplay');
                    if (emailDisplay) {
                        emailDisplay.value = email;
                    }
                    this.updateEmailList();
                    this.checkMessages(email);
                    this.updateExpirationIndicator();
                }
            }
        });
    }

    // Update the checkMessages method to show loading state
    async checkMessages(email) {
        if (!email || this.isChecking) return;
        
        try {
            this.isChecking = true;
            this.updateRefreshIcon(true);
            
            const messagesList = document.getElementById('messagesList');
            const messageCounter = document.getElementById('messageCounter');
            const lastChecked = document.getElementById('lastChecked');
            
            // Update last checked time
            this.lastChecked = new Date();
            lastChecked.textContent = `Last checked: ${this.lastChecked.toLocaleTimeString()}`;
            
            const messages = await this.emailService.checkMail(email);
            this.messageCount = messages.length;
            
            // Update message counter
            messageCounter.textContent = this.messageCount ? `(${this.messageCount})` : '';
            
            // Remove loading state
            messagesList.classList.remove('loading');
            
            if (messages.length === 0) {
                messagesList.innerHTML = `
                    <div class="no-messages fade-enter">No messages yet</div>
                `;
                // Force reflow
                messagesList.offsetHeight;
                messagesList.querySelector('.no-messages').classList.add('fade-enter-active');
                return;
            }
            
            // Sort messages by date (newest first)
            messages.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            const messagesHTML = messages.map(message => `
                <div class="message-item fade-enter" onclick="app.showEmailContent('${email}', ${message.id})">
                    <div class="message-header">
                        <span class="message-from">${message.from}</span>
                        <span class="message-date">${new Date(message.date).toLocaleString()}</span>
                    </div>
                    <div class="message-subject">${message.subject || 'No Subject'}</div>
                    ${message.attachments ? `
                        <div class="message-attachments">
                            <span class="attachment-icon">📎</span>
                            ${message.attachments.length} attachment(s)
                        </div>
                    ` : ''}
                </div>
            `).join('');
            
            messagesList.innerHTML = messagesHTML;
            
            // Trigger animations
            requestAnimationFrame(() => {
                messagesList.querySelectorAll('.message-item').forEach(item => {
                    item.classList.add('fade-enter-active');
                });
            });
            
        } catch (error) {
            console.error('Error checking messages:', error);
            messagesList.classList.remove('loading');
            messagesList.innerHTML = `
                <div class="error-message fade-enter">
                    Failed to load messages: ${error.message}
                </div>
            `;
            requestAnimationFrame(() => {
                messagesList.querySelector('.error-message').classList.add('fade-enter-active');
            });
        } finally {
            this.isChecking = false;
            this.updateRefreshIcon(false);
        }
    }

    async showEmailContent(email, messageId) {
        try {
            const [login, domain] = email.split('@');
            const response = await fetch(
                `${this.emailService.baseUrl}?action=readMessage&login=${login}&domain=${domain}&id=${messageId}`
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch email content');
            }
            
            const emailData = await response.json();
            
            const modal = document.getElementById('emailModal');
            const metadata = document.getElementById('emailMetadata');
            const content = document.getElementById('emailContent');
            const attachments = document.getElementById('emailAttachments');
            
            if (!modal || !metadata || !content || !attachments) return;
            
            // Enhanced metadata section
            metadata.innerHTML = `
                <div class="email-header-details">
                    <div class="email-subject">${emailData.subject || 'No Subject'}</div>
                    <div class="email-meta-row">
                        <span class="meta-label">From:</span>
                        <span class="meta-value">${emailData.from}</span>
                    </div>
                    <div class="email-meta-row">
                        <span class="meta-label">To:</span>
                        <span class="meta-value">${email}</span>
                    </div>
                    <div class="email-meta-row">
                        <span class="meta-label">Date:</span>
                        <span class="meta-value">${new Date(emailData.date).toLocaleString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}</span>
                    </div>
                </div>
            `;
            
            // Process and enhance email content
            let emailContent = emailData.htmlBody || emailData.textBody || 'No content';
            
            // If it's plain text, convert line breaks to HTML and make links clickable
            if (!emailData.htmlBody) {
                emailContent = emailContent
                    .replace(/\n/g, '<br>')
                    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
                    .replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi, 
                        '<a href="mailto:$1">$1</a>');
            }
            
            content.innerHTML = `
                <div class="email-content-wrapper">
                    ${emailContent}
                </div>
            `;
            
            // Enhanced attachments section
            if (emailData.attachments && emailData.attachments.length > 0) {
                attachments.innerHTML = `
                    <div class="attachments-header">
                        <h3>Attachments (${emailData.attachments.length})</h3>
                    </div>
                    <div class="attachments-list">
                        ${emailData.attachments.map(file => `
                            <div class="attachment-item">
                                <div class="attachment-icon">
                                    ${getAttachmentIcon(file.filename)}
                                </div>
                                <div class="attachment-details">
                                    <span class="attachment-name">${file.filename}</span>
                                    <span class="attachment-size">${formatFileSize(file.size)}</span>
                                </div>
                                <button class="btn small" onclick="downloadAttachment('${email}', ${messageId}, '${file.filename}')">
                                    Download
                                </button>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                attachments.innerHTML = '';
            }
            
            modal.style.display = 'flex';
            
            // Add close button event listener
            const closeBtn = document.getElementById('closeEmailModal');
            if (closeBtn) {
                closeBtn.onclick = () => {
                    modal.style.display = 'none';
                };
            }
            
        } catch (error) {
            console.error('Error showing email content:', error);
            this.showToast('Failed to load email content', 'error');
        }
    }

    copyEmail(email) {
        navigator.clipboard.writeText(email)
            .then(() => this.showToast('Email copied to clipboard'))
            .catch(() => this.showToast('Failed to copy email', 'error'));
    }

    deleteEmail(email) {
        if (this.emailService.deleteEmail(email)) {
            this.updateEmailList();
            if (this.currentEmail === email) {
                this.currentEmail = null;
                const emailDisplay = document.getElementById('emailDisplay');
                if (emailDisplay) {
                    emailDisplay.value = '';
                }
                const messagesList = document.getElementById('messagesList');
                if (messagesList) {
                    messagesList.innerHTML = '<div class="no-messages">No messages yet</div>';
                }
            }
            this.showToast('Email deleted successfully');
        } else {
            this.showToast('Failed to delete email', 'error');
        }
    }

    showExpirationDialog() {
        const dialog = document.getElementById('expirationDialog');
        if (dialog) {
            dialog.style.display = 'flex';
            // Reset selections
            document.querySelectorAll('.option').forEach(opt => 
                opt.classList.remove('selected'));
            document.getElementById('customTimeInput').style.display = 'none';
            document.getElementById('customValue').value = '';
        }
    }

    hideExpirationDialog() {
        const dialog = document.getElementById('expirationDialog');
        if (dialog) {
            dialog.style.display = 'none';
        }
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;

        // Clear any existing timeouts
        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
            clearTimeout(this.toastHideTimeout);
        }

        // Reset toast state
        toast.style.display = 'block';
        toast.className = `toast ${type}`;
        toast.textContent = message;

        // Force a reflow to ensure animation works
        toast.offsetHeight;

        // Show toast
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Hide toast after delay
        this.toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
            this.toastHideTimeout = setTimeout(() => {
                toast.style.display = 'none';
            }, 300);
        }, 3000);
    }

    generateEmailWithCustomDuration(value, unit) {
        const multipliers = {
            'hours': 60 * 60 * 1000,
            'days': 24 * 60 * 60 * 1000,
            'weeks': 7 * 24 * 60 * 60 * 1000,
            'months': 30 * 24 * 60 * 60 * 1000
        };

        const duration = value * multipliers[unit];
        this.generateEmailWithDuration(duration);
    }

    updateExpirationIndicator() {
        const indicator = document.getElementById('expirationIndicator');
        if (!indicator || !this.currentEmail) return;

        const remaining = this.emailService.getTimeUntilExpiration(this.currentEmail);
        if (!remaining) {
            indicator.innerHTML = '';
            return;
        }

        const formattedTime = this.emailService.formatRemainingTime(remaining);
        indicator.innerHTML = `
            <div class="expiration-badge ${this.getExpirationClass(remaining)}">
                Expires in: ${formattedTime}
            </div>
        `;
    }

    getExpirationClass(remaining) {
        const hours = remaining / (1000 * 60 * 60);
        if (hours <= 1) return 'critical';
        if (hours <= 24) return 'warning';
        return 'normal';
    }

    updateRefreshIcon(spinning) {
        const refreshIcon = document.querySelector('.refresh-icon');
        if (refreshIcon) {
            refreshIcon.classList.toggle('spinning', spinning);
        }
    }

    // Add quick actions for emails
    addQuickActions(email) {
        return `
            <div class="email-actions">
                <button class="action-btn" onclick="app.copyEmail('${email}')">
                    📋 Copy
                </button>
                <button class="action-btn" onclick="app.forwardEmail('${email}')">
                    ↗️ Forward
                </button>
                <button class="action-btn" onclick="app.downloadAttachments('${email}')">
                    📥 Download All
                </button>
                <button class="action-btn danger" onclick="app.deleteEmail('${email}')">
                    🗑️ Delete
                </button>
            </div>
        `;
    }

    updateStats() {
        const now = Date.now();
        const emails = Array.from(this.emailService.activeEmails.entries());
        
        const stats = {
            total: emails.length,
            active: emails.filter(([_, expiry]) => expiry > now).length,
            expired: emails.filter(([_, expiry]) => expiry <= now).length
        };
        
        document.getElementById('totalEmails').textContent = stats.total;
        document.getElementById('activeEmails').textContent = stats.active;
        document.getElementById('expiredEmails').textContent = stats.expired;
    }

    generateQuickEmail(duration) {
        const durations = {
            '1h': 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000
        };
        this.generateEmailWithDuration(durations[duration]);
    }

    exportEmails() {
        const emails = Array.from(this.emailService.activeEmails.entries())
            .map(([email, expiry]) => ({
                email,
                expiry: new Date(expiry).toISOString(),
                status: Date.now() > expiry ? 'expired' : 'active'
            }));
            
        const blob = new Blob([JSON.stringify(emails, null, 2)], 
            { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `email-history-${new Date().toISOString()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showToast('Email history exported successfully');
    }

    addSharingFeatures() {
        const sharingButtons = `
            <div class="sharing-options">
                <button class="share-btn" data-platform="whatsapp">
                    <span>📱 Share to WhatsApp</span>
                </button>
                <button class="share-btn" data-platform="telegram">
                    <span>✈️ Share to Telegram</span>
                </button>
                <button class="share-btn" data-platform="qr">
                    <span>📷 Show QR Code</span>
                </button>
                <button class="share-btn" data-platform="api">
                    <span>🔗 API Access</span>
                </button>
            </div>
        `;

        const emailCard = document.querySelector('.card:first-child');
        emailCard.insertAdjacentHTML('beforeend', sharingButtons);
        
        this.initializeSharingHandlers();
    }

    initializeSharingHandlers() {
        document.querySelector('.sharing-options').addEventListener('click', async (e) => {
            const btn = e.target.closest('.share-btn');
            if (!btn || !this.currentEmail) return;

            const platform = btn.dataset.platform;
            const emailData = {
                address: this.currentEmail,
                expiry: this.emailService.activeEmails.get(this.currentEmail),
                remaining: this.formatTimeRemaining(this.emailService.activeEmails.get(this.currentEmail) - Date.now())
            };

            switch (platform) {
                case 'whatsapp':
                    window.open(`https://wa.me/?text=${encodeURIComponent(
                        `Temporary Email: ${emailData.address}\nExpires in: ${emailData.remaining}`
                    )}`);
                    break;
                case 'telegram':
                    window.open(`https://t.me/share/url?url=${encodeURIComponent(
                        `Temporary Email: ${emailData.address}\nExpires in: ${emailData.remaining}`
                    )}`);
                    break;
                case 'qr':
                    this.showQRCode(emailData);
                    break;
                case 'api':
                    this.showAPIAccess(emailData);
                    break;
            }
        });
    }

    // ... rest of your methods ...
} 

// Helper function to get appropriate icon for file type
function getAttachmentIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        pdf: '📄',
        doc: '📝',
        docx: '📝',
        xls: '📊',
        xlsx: '📊',
        jpg: '🖼️',
        jpeg: '🖼️',
        png: '🖼️',
        gif: '🖼️',
        zip: '📦',
        rar: '📦'
    };
    return icons[ext] || '📎';
}

// Helper function to format file size
function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
} 

// Initialize the app
const app = new EmailApp(); 