class EmailService {
    constructor() {
        this.baseUrl = 'https://www.1secmail.com/api/v1/';
        this.domains = ['1secmail.com', '1secmail.org', '1secmail.net'];
        this.activeEmails = new Map();
        this.loadFromStorage();
        this.cleanExpiredEmails();
    }

    // Load active emails from localStorage
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('activeEmails');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.activeEmails = new Map(parsed);
            }
        } catch (error) {
            console.error('Error loading from storage:', error);
            this.activeEmails = new Map();
        }
    }

    // Save active emails to localStorage
    saveToStorage() {
        try {
            const serialized = JSON.stringify(Array.from(this.activeEmails.entries()));
            localStorage.setItem('activeEmails', serialized);
        } catch (error) {
            console.error('Error saving to storage:', error);
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
            const username = this.generateRandomString();
            const domain = this.domains[Math.floor(Math.random() * this.domains.length)];
            const email = `${username}@${domain}`;
            
            // Set expiration time
            const expiry = Date.now() + duration;
            this.activeEmails.set(email, expiry);
            this.saveToStorage();
            
            return email;
        } catch (error) {
            console.error('Error generating email:', error);
            throw new Error('Failed to generate email');
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
            const response = await fetch(
                `${this.baseUrl}?action=getMessages&login=${login}&domain=${domain}`
            );

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
}

class EmailApp {
    constructor() {
        this.emailService = new EmailService();
        this.currentEmail = null;
        this.initializeEventListeners();
        this.startAutoRefresh();
    }

    // Add auto-refresh functionality
    startAutoRefresh() {
        setInterval(() => {
            if (this.currentEmail) {
                this.checkMessages(this.currentEmail);
            }
        }, 30000); // Check every 30 seconds
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
                <div class="no-history">No active emails</div>
            `;
            return;
        }

        emailHistory.innerHTML = activeEmails.map(([email, expiry]) => `
            <div class="email-cell ${this.currentEmail === email ? 'active' : ''}" 
                 data-email="${email}">
                <div class="email-info">
                    <span class="email-address">${email}</span>
                    <span class="expiry-time">Expires: ${new Date(expiry).toLocaleString()}</span>
                </div>
                <button class="btn danger small" onclick="app.deleteEmail('${email}')">
                    Delete
                </button>
            </div>
        `).join('');
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
        const multipliers = {
            'hours': 60 * 60 * 1000,
            'days': 24 * 60 * 60 * 1000,
            'weeks': 7 * 24 * 60 * 60 * 1000,
            'months': 30 * 24 * 60 * 60 * 1000
        };

        const duration = value * multipliers[unit];
        this.generateEmailWithDuration(duration);
    }

    initializeEventListeners() {
        // ... existing event listeners ...

        // Add click event for email cells
        document.addEventListener('click', (e) => {
            const emailCell = e.target.closest('.email-cell');
            if (emailCell) {
                const email = emailCell.dataset.email;
                if (email) {
                    this.currentEmail = email;
                    const emailDisplay = document.getElementById('emailDisplay');
                    if (emailDisplay) {
                        emailDisplay.value = email;
                    }
                    // Remove active class from all cells and add to clicked one
                    document.querySelectorAll('.email-cell').forEach(cell => 
                        cell.classList.remove('active'));
                    emailCell.classList.add('active');
                    this.checkMessages(email);
                }
            }
        });

        // Add check mail button functionality
        const checkMailBtn = document.getElementById('checkMailBtn');
        if (checkMailBtn) {
            checkMailBtn.addEventListener('click', () => {
                if (this.currentEmail) {
                    this.checkMessages(this.currentEmail);
                } else {
                    this.showToast('No email selected', 'error');
                }
            });
        }

        // Add copy button functionality
        const copyBtn = document.getElementById('copyBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                if (this.currentEmail) {
                    this.copyEmail(this.currentEmail);
                } else {
                    this.showToast('No email to copy', 'error');
                }
            });
        }

        // Add clear history button functionality
        const clearAllBtn = document.getElementById('clearAllBtn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all email history?')) {
                    this.emailService.activeEmails.clear();
                    this.emailService.saveToStorage();
                    this.currentEmail = null;
                    this.updateEmailList();
                    const emailDisplay = document.getElementById('emailDisplay');
                    if (emailDisplay) {
                        emailDisplay.value = '';
                    }
                    const messagesList = document.getElementById('messagesList');
                    if (messagesList) {
                        messagesList.innerHTML = '<div class="no-messages">No messages yet</div>';
                    }
                    this.showToast('Email history cleared');
                }
            });
        }
    }

    // Update the checkMessages method to show loading state
    async checkMessages(email) {
        if (!email) return;
        
        try {
            const messagesList = document.getElementById('messagesList');
            if (!messagesList) return;
            
            // Add loading state
            messagesList.innerHTML = `
                <div class="loading-spinner"></div>
            `;
            
            const messages = await this.emailService.checkMail(email);
            
            if (messages.length === 0) {
                messagesList.innerHTML = `
                    <div class="no-messages">No messages yet</div>
                `;
                return;
            }
            
            messagesList.innerHTML = messages.map(message => `
                <div class="message-item" onclick="app.showEmailContent('${email}', ${message.id})">
                    <div class="message-header">
                        <span class="message-from">${message.from}</span>
                        <span class="message-date">${new Date(message.date).toLocaleString()}</span>
                    </div>
                    <div class="message-subject">${message.subject}</div>
                </div>
            `).join('');
            
        } catch (error) {
            console.error('Error checking messages:', error);
            const messagesList = document.getElementById('messagesList');
            if (messagesList) {
                messagesList.innerHTML = `
                    <div class="error-message">Failed to load messages</div>
                `;
            }
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
        if (toast) {
            toast.textContent = message;
            toast.className = `toast ${type}`;
            toast.style.display = 'block';
            
            // Hide after 3 seconds
            setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }
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