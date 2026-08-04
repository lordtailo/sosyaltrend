import './app.js?v=20260804b';

// Home page entrypoint — shared app.js contains the common application logic.

// Firebase hazırlanana kadar bekle, sonra duyuruları dinle
const initializeAnnouncements = () => {
    if (window.addAnnouncementsToFeed) {
        window.addAnnouncementsToFeed();
    }
    if (window.listenForAnnouncementChanges) {
        window.listenForAnnouncementChanges();
    }
};

// Check if we're still loading
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Ensure Firebase is initialized and user is ready
        if (auth?.currentUser || !auth) {
            initializeAnnouncements();
        } else {
            // Wait for auth to be ready
            const checkAuth = setInterval(() => {
                if (window.user && window.user.username) {
                    clearInterval(checkAuth);
                    initializeAnnouncements();
                }
            }, 100);
            
            // Fallback timeout
            setTimeout(() => {
                clearInterval(checkAuth);
                initializeAnnouncements();
            }, 2000);
        }
    });
} else {
    // DOM already loaded
    setTimeout(() => {
        if (window.user && window.user.username) {
            initializeAnnouncements();
        } else {
            const checkAuth = setInterval(() => {
                if (window.user && window.user.username) {
                    clearInterval(checkAuth);
                    initializeAnnouncements();
                }
            }, 100);
            
            setTimeout(() => {
                clearInterval(checkAuth);
                initializeAnnouncements();
            }, 2000);
        }
    }, 500);
}
