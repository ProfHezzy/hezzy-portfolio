document.addEventListener('DOMContentLoaded', function() {
    // Image Gallery Functionality
    function setupImageGallery() {
        const thumbnails = document.querySelectorAll('.thumbnail');
        const mainImage = document.getElementById('main-gallery-image');
        
        if (!thumbnails.length || !mainImage) return;
        
        thumbnails.forEach(thumbnail => {
            thumbnail.addEventListener('click', function() {
                // Remove active class from all thumbnails
                thumbnails.forEach(t => t.classList.remove('active'));
                
                // Add active class to clicked thumbnail
                this.classList.add('active');
                
                // Update main image
                const newImageSrc = this.dataset.image;
                mainImage.src = newImageSrc;
                
                // Add fade effect
                mainImage.style.opacity = '0';
                setTimeout(() => {
                    mainImage.style.opacity = '1';
                }, 300);
            });
        });
    }
    
    // Copy Link Functionality
    function setupCopyLink() {
        const copyButtons = document.querySelectorAll('.copy-link, .copy-btn');
        
        copyButtons.forEach(button => {
            button.addEventListener('click', function() {
                const url = window.location.href;
                
                navigator.clipboard.writeText(url).then(() => {
                    // Show tooltip or notification
                    const originalText = this.innerHTML;
                    this.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    
                    setTimeout(() => {
                        this.innerHTML = originalText;
                    }, 2000);
                }).catch(err => {
                    console.error('Failed to copy URL: ', err);
                    alert('Failed to copy URL to clipboard');
                });
            });
        });
    }
    
    // Social Share Buttons
    function setupSocialShare() {
        const socialButtons = document.querySelectorAll('.social-btn:not(.copy-link)');
        
        socialButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                if (this.tagName === 'A') return; // Let anchor tags work normally
                
                e.preventDefault();
                const url = this.href;
                const width = 600;
                const height = 400;
                const left = (window.innerWidth - width) / 2;
                const top = (window.innerHeight - height) / 2;
                
                window.open(url, 'share', `width=${width},height=${height},left=${left},top=${top}`);
            });
        });
    }
    
    // Smooth Scroll for Anchor Links
    function setupSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;
                
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    const headerHeight = document.querySelector('header')?.offsetHeight || 0;
                    const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }
    
    // Animation on Scroll
    function setupScrollAnimations() {
        const animateElements = document.querySelectorAll('.animate__animated');
        
        if (!animateElements.length) return;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const animation = entry.target.dataset.animation || 'fadeIn';
                    entry.target.classList.add(`animate__${animation}`);
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1
        });
        
        animateElements.forEach(element => {
            observer.observe(element);
        });
    }
    
    // Initialize all functions
    setupImageGallery();
    setupCopyLink();
    setupSocialShare();
    setupSmoothScroll();
    setupScrollAnimations();
    
    // Add animation delay to project cards
    const projectCards = document.querySelectorAll('.project-card');
    projectCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
    });
});