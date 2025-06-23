// blog_detail.js
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded: Initializing blog_detail.js');

    // --- Global Variables from Django Context (set in blog_detail.html) ---
    const USER_IS_AUTHENTICATED = window.USER_IS_AUTHENTICATED === 'true';
    const USER_FULL_NAME = window.USER_FULL_NAME || '';
    const USER_EMAIL = window.USER_EMAIL || '';
    const postSlug = window.POST_SLUG || null;
    const blogPostId = window.POST_ID || null;

    console.log('USER_IS_AUTHENTICATED:', USER_IS_AUTHENTICATED);
    console.log('USER_FULL_NAME:', USER_FULL_NAME);
    console.log('USER_EMAIL:', USER_EMAIL);
    console.log('postSlug from window:', postSlug);
    console.log('blogPostId from window:', blogPostId);

    // --- DOM Elements ---
    const commentsList = document.getElementById('comments-list');
    const commentForm = document.getElementById('comment-form');
    const likeButton = document.querySelector('.like-btn'); 
    const likeCountSpan = likeButton ? likeButton.querySelector('.like-count') : null;
    const commentsCountSpan = document.querySelector('.comment-count-badge'); 
    
    console.log('likeButton found:', !!likeButton);
    console.log('likeCountSpan found:', !!likeCountSpan);
    console.log('commentsCountSpan (for total) found:', !!commentsCountSpan);

    const progressBar = document.getElementById('progress-bar');
    const backToTop = document.querySelector('.back-to-top'); 

    // --- Helper for Toast Notifications ---
    function showToast(message, type = 'success') {
        let toast = document.getElementById('toast-message');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast-message';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.className = `toast show ${type}`; 

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove(); 
            }, 300); 
        }, 3000); 
    }

    // --- Helper function to get CSRF token ---
    function getCookie(name) {
        if (name === 'csrftoken' && window.CSRF_TOKEN) {
            console.log('Using CSRF_TOKEN from window global.');
            return window.CSRF_TOKEN;
        }

        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        console.log(`CSRF Token (${name}):`, cookieValue ? 'Found' : 'Not Found (from cookie fallback)');
        return cookieValue;
    }

    // --- Comment Form Submission (Main Form) ---
    if (commentForm) {
        commentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('Main comment form submitted.');

            const formData = new FormData(this);
            const submitButton = this.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.innerHTML;
            
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';

            if (USER_IS_AUTHENTICATED) {
                formData.delete('name');
                formData.delete('email');
                console.log('User is authenticated, removed name/email from main comment form data.');
            }

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRFToken': getCookie('csrftoken') 
                    }
                });

                const result = await response.json();
                console.log('Main comment form response:', result);

                if (result.success) {
                    showToast('Comment posted successfully!', 'success');
                    const newCommentHtml = createCommentElement(result.comment);

                    if (commentsCountSpan) {
                        commentsCountSpan.textContent = parseInt(commentsCountSpan.textContent || '0') + 1;
                        console.log('Comments count updated:', commentsCountSpan.textContent);
                    }

                    commentsList.insertAdjacentHTML('afterbegin', newCommentHtml);
                    
                    const noCommentsMsg = document.querySelector('.no-comments');
                    if (noCommentsMsg) {
                        noCommentsMsg.remove();
                        console.log('Removed "No comments yet" message.');
                    }

                    this.reset(); 
                    document.querySelectorAll('.comment-reply-form').forEach(form => form.style.display = 'none');

                    setupCommentReplies(); 
                } else {
                    if (result.errors) {
                        let errorMessages = '';
                        for (const field in result.errors) {
                            let fieldName = field.charAt(0).toUpperCase() + field.slice(1);
                            errorMessages += `${fieldName}: ${result.errors[field].join(', ')}\n`;
                        }
                        showToast(`Error: ${errorMessages.trim()}`, 'error');
                        console.error('Main comment form submission errors:', result.errors);
                    } else {
                        showToast('Failed to post comment. Please try again.', 'error');
                        console.error('Main comment form submission failed:', result);
                    }
                }
            } catch (error) {
                console.error('Network or server error submitting main comment form:', error);
                showToast('A network error occurred. Please try again.', 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
            }
        });
    } else {
        console.warn('Comment form (#comment-form) not found. Comment submission disabled.');
    }

    // --- Create Comment Element (HTML for new comments/replies) ---
    function createCommentElement(commentData) {
        let nameInputRequired = '';
        let emailInputRequired = ''; 
        let nameInputPlaceholder = "Name";
        let emailInputPlaceholder = "Email (Optional)";
        let nameInputValue = "";
        let emailInputValue = "";
        let nameInputReadOnly = "";
        let emailInputReadOnly = "";

        if (USER_IS_AUTHENTICATED) {
            nameInputValue = USER_FULL_NAME;
            emailInputValue = USER_EMAIL;
            nameInputReadOnly = "readonly";
            emailInputReadOnly = "readonly";
        } else {
            nameInputRequired = 'required';
        }

        const nameInputHtml = `<input type="text" name="name" placeholder="${nameInputPlaceholder}" value="${nameInputValue}" ${nameInputRequired} ${nameInputReadOnly}>`;
        const emailInputHtml = `<input type="email" name="email" placeholder="${emailInputPlaceholder}" value="${emailInputValue}" ${emailInputRequired} ${emailInputReadOnly}>`;
        
        return `
            <div class="comment ${commentData.parent_id ? 'comment-reply-item' : ''}" id="comment-${commentData.id}">
                <div class="comment-header">
                    <img src="${commentData.avatar_url || '/static/images/default_user_avatar.jpg'}" alt="${commentData.author}" class="comment-avatar">
                    <div>
                        <span class="comment-author">${commentData.author}</span>
                        <span class="comment-date">${commentData.created_at}</span>
                    </div>
                </div>
                <div class="comment-body">
                    <p>${commentData.content.replace(/\n/g, '<br>')}</p>
                </div>
                <button class="comment-reply" data-comment-id="${commentData.id}">Reply</button>
                <div class="comment-reply-form" id="reply-form-${commentData.id}" style="display: none;">
                    <form class="reply-inner-form" data-comment-id="${commentData.id}">
                        ${getCookie('csrftoken') ? '<input type="hidden" name="csrfmiddlewaretoken" value="' + getCookie('csrftoken') + '">' : ''}
                        <h3>Reply to ${commentData.author}</h3>
                        <div class="form-group">
                            <textarea name="content" placeholder="Write your reply..." required></textarea>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                ${nameInputHtml}
                            </div>
                            <div class="form-group">
                                ${emailInputHtml}
                            </div>
                        </div>
                        <input type="hidden" name="parent" value="${commentData.id}">
                        <input type="hidden" name="post" value="${blogPostId}">
                        <div class="reply-actions">
                            <button type="button" class="btn btn-secondary cancel-reply">Cancel</button>
                            <button type="submit" class="btn btn-primary submit-reply">Post Reply</button>
                        </div>
                    </form>
                </div>
                <div class="replies"></div> 
            </div>
        `;
    }

    // --- Handle comment reply buttons (Initial setup & Re-attach after AJAX) ---
    function setupCommentReplies() {
        console.log('Setting up comment reply listeners...');
        document.querySelectorAll('.comment-reply').forEach(button => {
            button.removeEventListener('click', toggleReplyForm);
        });
        document.querySelectorAll('.comment-reply-form form').forEach(form => {
            form.removeEventListener('submit', submitReplyForm);
            const cancelButton = form.querySelector('.cancel-reply');
            if (cancelButton) {
                cancelButton.removeEventListener('click', hideReplyForm);
            }
        });

        document.querySelectorAll('.comment-reply').forEach(button => {
            button.addEventListener('click', toggleReplyForm);
        });

        document.querySelectorAll('.comment-reply-form form').forEach(replyInnerForm => {
            replyInnerForm.addEventListener('submit', submitReplyForm);
            const cancelButton = replyInnerForm.querySelector('.cancel-reply');
            if (cancelButton) {
                cancelButton.addEventListener('click', hideReplyForm);
            }
        });
    }

    // --- Toggle Reply Form Display ---
    function toggleReplyForm(e) {
        const commentId = e.target.dataset.commentId;
        const replyFormDiv = document.getElementById(`reply-form-${commentId}`);
        console.log('Toggling reply form for comment ID:', commentId, 'Form found:', !!replyFormDiv);

        if (!replyFormDiv) {
            console.error('Reply form container not found for comment ID:', commentId);
            return;
        }

        document.querySelectorAll('.comment-reply-form').forEach(form => {
            if (form.id !== `reply-form-${commentId}`) {
                form.style.display = 'none';
            }
        });

        const currentDisplay = replyFormDiv.style.display;
        replyFormDiv.style.display = currentDisplay === 'none' ? 'block' : 'none';

        if (replyFormDiv.style.display === 'block') {
            const parentInput = replyFormDiv.querySelector('input[name="parent"]');
            const postInput = replyFormDiv.querySelector('input[name="post"]');
            
            if (parentInput) parentInput.value = commentId;
            if (postInput) postInput.value = blogPostId; 
            console.log('Reply form opened. Parent:', parentInput.value, 'Post:', postInput.value);
        }
    }

    // --- Submit Reply Form ---
    async function submitReplyForm(e) {
        e.preventDefault();
        const replyForm = e.target;
        const parentCommentId = replyForm.dataset.commentId; 
        console.log('Reply form submitted for parent comment ID:', parentCommentId);

        const submitButton = replyForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.innerHTML;

        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';

        const formData = new FormData(replyForm);

        if (USER_IS_AUTHENTICATED) {
            formData.delete('name');
            formData.delete('email');
            console.log('User is authenticated, removed name/email from reply form data.');
        }

        try {
            const response = await fetch(commentForm.action, { 
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': getCookie('csrftoken')
                }
            });

            const result = await response.json();
            console.log('Reply form response:', result);

            if (result.success) {
                showToast('Reply posted successfully!', 'success');
                const newCommentHtml = createCommentElement(result.comment);

                if (commentsCountSpan) {
                    commentsCountSpan.textContent = parseInt(commentsCountSpan.textContent || '0') + 1;
                    console.log('Comments count updated (reply):', commentsCountSpan.textContent);
                }

                const parentCommentDiv = document.getElementById(`comment-${result.comment.parent_id}`);
                if (parentCommentDiv) {
                    let repliesContainer = parentCommentDiv.querySelector('.replies');
                    if (!repliesContainer) {
                        repliesContainer = document.createElement('div');
                        repliesContainer.className = 'replies';
                        parentCommentDiv.appendChild(repliesContainer);
                        console.log('Created new replies container for comment ID:', result.comment.parent_id);
                    }
                    repliesContainer.insertAdjacentHTML('beforeend', newReplyHtml);
                    console.log('Reply appended to parent comment ID:', result.comment.parent_id);
                } else {
                    console.warn('Parent comment div not found for reply:', result.comment.parent_id);
                    commentsList.insertAdjacentHTML('afterbegin', newCommentHtml);
                }
                replyForm.reset();
                replyForm.closest('.comment-reply-form').style.display = 'none';

                setupCommentReplies(); 
            } else {
                if (result.errors) {
                    let errorMessages = '';
                    for (const field in result.errors) {
                        let fieldName = field.charAt(0).toUpperCase() + field.slice(1);
                        errorMessages += `${fieldName}: ${result.errors[field].join(', ')}\n`;
                    }
                    showToast(`Error: ${errorMessages.trim()}`, 'error');
                    console.error('Reply form submission errors:', result.errors);
                } else {
                    showToast('Failed to post reply. Please try again.', 'error');
                    console.error('Reply form submission failed:', result);
                }
            }
        } catch (error) {
            console.error('Network or server error submitting reply form:', error);
            showToast('A network error occurred. Please try again.', 'error');
        } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
        }
    }

    function hideReplyForm(e) {
        e.preventDefault();
        e.target.closest('.comment-reply-form').style.display = 'none';
        console.log('Reply form hidden.');
    }

    // --- Table of Contents Generation ---
    function generateTOC() {
        const postContent = document.querySelector('.post-content');
        const tocList = document.querySelector('#toc-nav'); 
        if (!postContent || !tocList) {
            console.warn('TOC elements not found (post-content or #toc-nav). Skipping TOC generation.');
            return;
        }

        const headings = postContent.querySelectorAll('h2, h3, h4');
        tocList.innerHTML = ''; 

        let currentUlStack = [tocList]; 

        headings.forEach((heading, index) => {
            const id = `heading-${heading.tagName.toLowerCase()}-${index}-${heading.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-*|-*$/g, '').substring(0, 30)}`;
            heading.id = id;

            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = `#${id}`;
            a.textContent = heading.textContent;
            li.appendChild(a);

            const level = parseInt(heading.tagName.substring(1));
            const currentStackLevel = parseInt(currentUlStack[currentUlStack.length - 1].dataset.level || 0);

            if (level === currentStackLevel) {
                currentUlStack[currentUlStack.length - 1].appendChild(li);
            } else if (level > currentStackLevel) {
                let newUl = document.createElement('ul');
                newUl.classList.add(`toc-sublist-level-${level - 1}`);
                newUl.dataset.level = level; 
                currentUlStack[currentUlStack.length - 1].appendChild(newUl);
                newUl.appendChild(li);
                currentUlStack.push(newUl);
            } else {
                while (currentUlStack.length > 1 && level < parseInt(currentUlStack[currentUlStack.length - 1].dataset.level || 0)) {
                    currentUlStack.pop();
                }
                if (currentUlStack.length === 1 && level < parseInt(currentUlStack[0].dataset.level || 0)) {
                    currentUlStack[0].dataset.level = level;
                }
                currentUlStack[currentUlStack.length - 1].appendChild(li);
            }
            li.classList.add(`toc-${heading.tagName.toLowerCase()}`);
        });
        console.log('Table of Contents generated.');
    }

    // --- Highlight active TOC item on scroll ---
    function highlightActiveTOCItem() {
        const postContent = document.querySelector('.post-content');
        if (!postContent) return;

        const observer = new IntersectionObserver((entries) => {
            let activeLinkFound = false;
            entries.forEach(entry => {
                const id = entry.target.id;
                const tocLink = document.querySelector(`#toc-nav a[href="#${id}"]`); 

                if (tocLink) {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                        document.querySelectorAll('#toc-nav a').forEach(link => link.classList.remove('active')); 
                        tocLink.classList.add('active');
                        activeLinkFound = true;

                        const tocContainer = document.querySelector('.toc-sidebar .toc-nav'); 
                        if (tocContainer) {
                            const linkRect = tocLink.getBoundingClientRect();
                            const containerRect = tocContainer.getBoundingClientRect();
                            const scrollOffset = tocLink.offsetTop - tocContainer.offsetTop - (containerRect.height / 2) + (linkRect.height / 2);
                            tocContainer.scrollTo({ top: scrollOffset, behavior: 'smooth' });
                        }
                    }
                }
            });

            if (!activeLinkFound) {
                const firstVisibleHeading = Array.from(postContent.querySelectorAll('h2[id], h3[id], h4[id]')).find(heading => {
                    const rect = heading.getBoundingClientRect();
                    return rect.top < window.innerHeight && rect.bottom > 0;
                });

                if (firstVisibleHeading) {
                    const tocLink = document.querySelector(`#toc-nav a[href="#${firstVisibleHeading.id}"]`); 
                    if (tocLink && !tocLink.classList.contains('active')) {
                        document.querySelectorAll('#toc-nav a').forEach(link => link.classList.remove('active')); 
                        tocLink.classList.add('active');
                    }
                }
            }
        }, { threshold: [0, 0.1, 0.5, 0.9, 1] });

        document.querySelectorAll('.post-content h2[id], .post-content h3[id], .post-content h4[id]').forEach((section) => {
            observer.observe(section);
        });
        console.log('TOC highlighting initialized.');
    }

    // --- Smooth scroll for TOC links ---
    function setupTOCSmoothScroll() {
        document.querySelectorAll('#toc-nav a').forEach(link => { 
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.getAttribute('href');
                const targetElement = document.querySelector(targetId);

                if (targetElement) {
                    const header = document.querySelector('header'); 
                    const headerHeight = header ? header.offsetHeight : 0;

                    window.scrollTo({
                        top: targetElement.offsetTop - headerHeight - 20, 
                        behavior: 'smooth'
                    });
                    console.log('Smooth scrolling to TOC item:', targetId);
                }
            });
        });
    }

    // --- Reading Progress Indicator ---
    function setupReadingProgress() {
        const progressBarElement = document.getElementById('progress-bar');
        if (!progressBarElement) {
            console.warn('Progress bar element (#progress-bar) not found. Skipping reading progress.');
            return;
        }
        
        window.addEventListener('scroll', () => {
            const documentHeight = document.documentElement.scrollHeight;
            const viewportHeight = window.innerHeight;
            const scrollPosition = window.scrollY;

            let progress = 0;
            if (documentHeight > viewportHeight) {
                progress = (scrollPosition / (documentHeight - viewportHeight)) * 100;
            }
            
            progressBarElement.style.width = `${progress}%`;
        });
        console.log('Reading progress indicator initialized.');
    }

    // --- Back to Top Button ---
    function setupBackToTop() {
        const backToTopButton = document.querySelector('.back-to-top'); 
        if (!backToTopButton) {
            console.warn('Back to top button (.back-to-top) not found. Skipping back to top functionality.');
            return;
        }
        
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) { 
                backToTopButton.classList.add('visible');
            } else {
                backToTopButton.classList.remove('visible');
            }
        });
        
        backToTopButton.addEventListener('click', (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            console.log('Back to top button clicked.');
        });
    }

    // --- Smooth Scroll for General Anchor Links ---
    function setupSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            if (anchor.closest('#toc-nav') || anchor.classList.contains('scroll-to-comments')) return; 

            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.getAttribute('href');
                if (targetId === '#') return; 

                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    const headerHeight = document.querySelector('header')?.offsetHeight || 0;
                    const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20; 
                    
                    window.scrollTo({ top: targetPosition, behavior: 'smooth' });
                    
                    if (history.pushState) {
                        history.pushState(null, null, targetId);
                    } else {
                        location.hash = targetId;
                    }
                    console.log('General smooth scroll to:', targetId);
                }
            });
        });
    }

    // --- Copy code blocks functionality ---
    function setupCodeCopyButtons() {
        document.querySelectorAll('pre').forEach(pre => {
            if (pre.querySelector('.copy-code')) {
                return;
            }

            const button = document.createElement('button');
            button.className = 'copy-code';
            button.innerHTML = '<i class="far fa-copy"></i>'; 
            button.title = 'Copy code';

            button.addEventListener('click', () => {
                const code = pre.querySelector('code').innerText;
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(code).then(() => {
                        button.innerHTML = '<i class="fas fa-check"></i>'; 
                        button.title = 'Copied!';
                        showToast('Code copied to clipboard!', 'success');
                        setTimeout(() => {
                            button.innerHTML = '<i class="far fa-copy"></i>';
                            button.title = 'Copy code';
                        }, 2000); 
                    }).catch(err => {
                        console.error('Failed to copy text using clipboard API: ', err);
                        fallbackCopyToClipboard(code, button);
                    });
                } else {
                    fallbackCopyToClipboard(code, button);
                }
            });

            pre.style.position = 'relative';
            pre.insertBefore(button, pre.firstChild); 
        });
        console.log('Code copy buttons initialized.');
    }

    // Fallback for copying text for older browsers or restricted environments
    function fallbackCopyToClipboard(text, button) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select(); 

        try {
            document.execCommand('copy'); 
            button.innerHTML = '<i class="fas fa-check"></i>';
            button.title = 'Copied!';
            showToast('Code copied to clipboard (fallback)!', 'success');
            setTimeout(() => {
                button.innerHTML = '<i class="far fa-copy"></i>';
                button.title = 'Copy code';
            }, 2000);
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
            showToast('Failed to copy code. Please copy manually.', 'error');
        } finally {
            document.body.removeChild(textArea); 
        }
    }

    // --- Social share functionality ---
    function setupSocialSharing() {
        // Target both floating social buttons (.social-btn) and footer share buttons (.share-btn)
        document.querySelectorAll('.social-btn, .share-btn').forEach(button => { 
            button.addEventListener('click', async function(e) { 
                e.preventDefault();

                // Get current page URL (without hash for cleaner share)
                const currentUrl = window.location.href.split('#')[0];
                // Get the main post title from the hero section, fallback to document title
                const postTitle = document.querySelector('.blog-hero .hero-title')?.innerText || document.title;
                
                // Handle Copy Link specifically with better feedback
                if (this.classList.contains('copy-link')) {
                    const originalIcon = this.innerHTML; 
                    const buttonElement = this; 

                    buttonElement.disabled = true; 
                    buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; 

                    try {
                        if (navigator.clipboard) {
                            await navigator.clipboard.writeText(currentUrl);
                            showToast('Link copied to clipboard!', 'success');
                        } else {
                            const textArea = document.createElement('textarea');
                            textArea.value = currentUrl;
                            textArea.style.position = "fixed";
                            document.body.appendChild(textArea);
                            textArea.focus();
                            textArea.select();
                            document.execCommand('copy');
                            textArea.remove();
                            showToast('Link copied (fallback)!', 'success');
                        }
                        buttonElement.innerHTML = '<i class="fas fa-check"></i>';
                        setTimeout(() => {
                            buttonElement.innerHTML = originalIcon; 
                            buttonElement.disabled = false; 
                        }, 2000); 
                    } catch (err) {
                        console.error('Failed to copy link:', err);
                        showToast('Failed to copy link. Please copy manually.', 'error');
                        buttonElement.innerHTML = originalIcon; 
                        buttonElement.disabled = false; 
                    }
                    return; 
                }

                // --- Generic Social Share Logic ---
                // Encode URL and title for use in query parameters
                const encodedUrl = encodeURIComponent(currentUrl);
                const encodedTitle = encodeURIComponent(postTitle); 

                let shareUrl = '';
                if (this.classList.contains('twitter')) {
                    shareUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
                } else if (this.classList.contains('linkedin')) {
                    shareUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}`;
                } else if (this.classList.contains('facebook')) {
                    shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
                }

                if (shareUrl) {
                    window.open(shareUrl, '_blank', 'width=600,height=400,toolbar=no,menubar=no,status=no,location=no');
                    console.log('Sharing via:', this.classList[1], 'URL:', shareUrl);
                }
            });
        });
        console.log('Social sharing buttons initialized.');
    }

    // --- Initialize animations ---
    function initAnimations() {
        const animateElements = [
            ...document.querySelectorAll('.related-card, .comment, .comment-form, .author-card, .hero-title, .hero-meta, .breadcrumb, .scroll-indicator, .bio-avatar, .bio-content, .cta-content, .newsletter-card') 
        ];

        animateElements.forEach((el, index) => {
            if (!el.classList.contains('animate__animated')) {
                el.style.opacity = '0';
                el.style.transform = 'translateY(20px)';
                el.style.transition = `opacity 0.5s ease ${index * 0.05}s, transform 0.5s ease ${index * 0.05}s`; 
            }
        });

        setTimeout(() => {
            animateElements.forEach(el => {
                if (!el.classList.contains('animate__animated')) {
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                }
            });
        }, 100);

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    if (!entry.target.classList.contains('animate__animated')) {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }
                    if (entry.target.classList.contains('animate__animated') && !entry.target.classList.contains('animate__done')) {
                        entry.target.classList.add('animate__done'); 
                    }
                    observer.unobserve(entry.target); 
                }
            });
        }, { threshold: 0.1 }); 

        animateElements.forEach(el => {
            observer.observe(el);
        });
        console.log('Animations initialized.');
    }

    /* like functionality */
    // --- Like Button Logic ---
    if (likeButton) {
        console.log('Like button element found (.like-btn). Attaching event listener.');
        likeButton.addEventListener('click', async function() {
            console.log('Like button clicked.');

            // if (!USER_IS_AUTHENTICATED) {
            //     showToast('Please log in to like this post.', 'info');
            //     console.warn('Like failed: User not authenticated.');
            //     return;
            // }
            
            // Use the postSlug from the global window object
            const likeUrl = `/blog/${postSlug}/like/`;
            console.log('Like API URL:', likeUrl);

            this.disabled = true; // Disable button to prevent multiple clicks
            // Optionally add a loading spinner
            const heartIcon = this.querySelector('.heart-icon');
            const originalHeartHTML = heartIcon.innerHTML;
            heartIcon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';


            try {
                const response = await fetch(likeUrl, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': getCookie('csrftoken'),
                        'X-Requested-With': 'XMLHttpRequest' // Helps Django identify AJAX requests
                    },
                });

                if (!response.ok) { // Check for HTTP errors (4xx, 5xx)
                    const errorText = await response.text();
                    console.error('HTTP Error during like API call:', response.status, response.statusText, errorText);
                    showToast(`Error: ${response.status} ${response.statusText}`, 'error');
                    return; // Stop execution on HTTP error
                }

                const data = await response.json();
                console.log('Like API response data:', data);

                if (data.success) {
                    if (likeCountSpan) {
                        likeCountSpan.textContent = data.likes_count;
                        console.log('Like count updated to:', data.likes_count);
                    }

                    if (data.has_liked) {
                        this.classList.add('liked');
                        showToast(data.message || 'Post liked!', 'success');
                    } else {
                        this.classList.remove('liked');
                        showToast(data.message || 'Post unliked!', 'info');
                    }
                } else {
                    showToast(data.message || 'Failed to process like. Please try again.', 'error');
                    console.error('Like API returned success: false. Message:', data.message);
                }
            } catch (error) {
                console.error('Error liking post (network/parsing error):', error);
                showToast('A network error occurred while processing your like.', 'error');
            } finally {
                this.disabled = false; // Always re-enable button
                // Revert spinner to original heart icon
                if (heartIcon) {
                    heartIcon.innerHTML = originalHeartHTML;
                }
            }
        });
    } else {
        console.warn('Like button element (.like-btn) not found. Like functionality disabled.');
    }


    // --- Add scroll to comments for the comment-btn ---
    const scrollToCommentsBtn = document.querySelector('.comment-btn.scroll-to-comments');
    if (scrollToCommentsBtn) {
        scrollToCommentsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const commentsSection = document.getElementById('comments');
            if (commentsSection) {
                const header = document.querySelector('header');
                const headerHeight = header ? header.offsetHeight : 0;
                window.scrollTo({
                    top: commentsSection.offsetTop - headerHeight - 20, 
                    behavior: 'smooth'
                });
                console.log('Scrolled to comments section.');
            }
        });
    }


    // --- Main Initialization Function ---
    function initializeBlogDetailFeatures() {
        generateTOC();
        highlightActiveTOCItem();
        setupTOCSmoothScroll();
        setupCommentReplies(); 
        setupCodeCopyButtons();
        setupSocialSharing(); 
        initAnimations();
        setupReadingProgress();
        setupBackToTop();
        setupSmoothScroll(); 
        
        console.log('All blog detail features initialized.');
    }

    initializeBlogDetailFeatures();
});
