document.addEventListener('DOMContentLoaded', function() {
    // Table of Contents Generator
    function generateTOC() {
        const headings = document.querySelectorAll('.post-content h2, .post-content h3');
        const tocNav = document.getElementById('toc-nav');
        
        if (headings.length === 0 || !tocNav) return;
        
        let tocHTML = '';
        let previousLevel = 2; // Start with h2
        
        headings.forEach((heading, index) => {
            const level = parseInt(heading.tagName.substring(1));
            const id = `heading-${index}`;
            heading.id = id;
            
            // Add margin based on heading level
            if (level > previousLevel) {
                tocHTML += '<ul class="toc-sublist">';
            } else if (level < previousLevel) {
                tocHTML += '</ul>';
            }
            
            tocHTML += `
                <li class="toc-item toc-level-${level}">
                    <a href="#${id}" data-id="${id}">${heading.textContent}</a>
                </li>
            `;
            
            previousLevel = level;
        });
        
        tocNav.innerHTML = tocHTML;
        
        // Highlight active TOC item on scroll
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.5
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const id = entry.target.id;
                const tocLink = document.querySelector(`.toc-nav a[href="#${id}"]`);
                
                if (entry.isIntersecting) {
                    document.querySelectorAll('.toc-nav a').forEach(link => {
                        link.classList.remove('active');
                    });
                    if (tocLink) tocLink.classList.add('active');
                }
            });
        }, observerOptions);
        
        headings.forEach(heading => {
            observer.observe(heading);
        });
    }
    
    // Reading Progress Indicator
    function setupReadingProgress() {
        const progressBar = document.getElementById('progress-bar');
        if (!progressBar) return;
        
        window.addEventListener('scroll', () => {
            const windowHeight = window.innerHeight;
            const docHeight = document.documentElement.scrollHeight;
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const progress = (scrollTop / (docHeight - windowHeight)) * 100;
            
            progressBar.style.width = `${progress}%`;
        });
    }
    
    // Back to Top Button
    function setupBackToTop() {
        const backToTop = document.getElementById('back-to-top');
        if (!backToTop) return;
        
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                backToTop.classList.add('visible');
            } else {
                backToTop.classList.remove('visible');
            }
        });
        
        backToTop.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
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
                    
                    // Update URL without jumping
                    if (history.pushState) {
                        history.pushState(null, null, targetId);
                    } else {
                        location.hash = targetId;
                    }
                }
            });
        });
    }
    
    // Like Button Functionality
    function setupLikeButton() {
        const likeButton = document.querySelector('.like-btn');
        if (!likeButton) return;
        
        likeButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const postId = this.dataset.postId;
            const postSlug = this.dataset.postSlug;
            const isAuthenticated = window.USER_IS_AUTHENTICATED === 'true';
            
            if (!isAuthenticated) {
                // Show login modal or redirect
                window.location.href = `/login/?next=/blog/${postSlug}/`;
                return;
            }
            
            const isLiked = this.classList.contains('liked');
            const likeCountElement = this.querySelector('.like-count');
            let likeCount = parseInt(likeCountElement.textContent);
            
            // Optimistic UI update
            this.classList.toggle('liked');
            likeCountElement.textContent = isLiked ? likeCount - 1 : likeCount + 1;
            
            // Send AJAX request
            fetch(`/blog/${postSlug}/like/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': window.CSRF_TOKEN
                },
                body: JSON.stringify({
                    post_id: postId,
                    action: isLiked ? 'unlike' : 'like'
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'error') {
                    // Revert UI if error
                    this.classList.toggle('liked');
                    likeCountElement.textContent = likeCount;
                    alert(data.message);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                // Revert UI on error
                this.classList.toggle('liked');
                likeCountElement.textContent = likeCount;
            });
        });
    }
    
    // Comment Form Submission
    function setupCommentForm() {
        const commentForm = document.getElementById('comment-form');
        if (!commentForm) return;
        
        commentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const submitButton = this.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.innerHTML;
            
            // Show loading state
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
            
            fetch(this.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': formData.get('csrfmiddlewaretoken')
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Reset form
                    this.reset();
                    
                    // Add new comment to the list
                    const commentsList = document.getElementById('comments-list');
                    const noComments = commentsList.querySelector('.no-comments');
                    
                    if (noComments) {
                        noComments.remove();
                    }
                    
                    // Create new comment element
                    const commentDiv = document.createElement('div');
                    commentDiv.innerHTML = data.html;
                    commentsList.insertBefore(commentDiv.firstChild, commentsList.firstChild);
                    
                    // Update comment count
                    const commentCountElements = document.querySelectorAll('.comment-count, .comments-count .count-value');
                    commentCountElements.forEach(el => {
                        const currentCount = parseInt(el.textContent);
                        el.textContent = currentCount + 1;
                    });
                    
                    // Scroll to new comment
                    setTimeout(() => {
                        document.getElementById(`comment-${data.comment_id}`).scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                        });
                    }, 300);
                } else {
                    // Show errors
                    alert(data.errors.join('\n'));
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred while submitting your comment. Please try again.');
            })
            .finally(() => {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
            });
        });
        
        // Pre-fill form for authenticated users
        if (window.USER_IS_AUTHENTICATED === 'true') {
            const nameField = commentForm.querySelector('input[name="name"]');
            const emailField = commentForm.querySelector('input[name="email"]');
            
            if (nameField && window.USER_FULL_NAME) {
                nameField.value = window.USER_FULL_NAME;
            }
            if (emailField && window.USER_EMAIL) {
                emailField.value = window.USER_EMAIL;
            }
        }
    }
    
    // Scroll to Comments Button
    function setupScrollToComments() {
        const scrollButton = document.querySelector('.scroll-to-comments');
        if (!scrollButton) return;
        
        scrollButton.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('comments').scrollIntoView({
                behavior: 'smooth'
            });
        });
    }
    
    // Copy Link Button
    function setupCopyLinkButton() {
        const copyButton = document.querySelector('.copy-link');
        if (!copyButton) return;
        
        copyButton.addEventListener('click', function() {
            const url = window.location.href;
            
            navigator.clipboard.writeText(url).then(() => {
                const tooltip = this.querySelector('.tooltip');
                if (tooltip) {
                    tooltip.textContent = 'Copied!';
                    setTimeout(() => {
                        tooltip.textContent = 'Copy Link';
                    }, 2000);
                }
            }).catch(err => {
                console.error('Failed to copy URL: ', err);
            });
        });
    }
    
    // Social Share Buttons
    function setupSocialShare() {
        document.querySelectorAll('.share-btn').forEach(button => {
            button.addEventListener('click', function(e) {
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
    
    // Initialize all functions
    generateTOC();
    setupReadingProgress();
    setupBackToTop();
    setupSmoothScroll();
    setupLikeButton();
    setupCommentForm();
    setupScrollToComments();
    setupCopyLinkButton();
    setupSocialShare();
    
    // Lazy load images
    if (typeof LazyLoad !== 'undefined') {
        new LazyLoad({
            elements_selector: ".lazy"
        });
    }
    
    // Animation on scroll
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 800,
            easing: 'ease-in-out',
            once: true
        });
    }
});