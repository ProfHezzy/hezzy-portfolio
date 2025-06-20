// blog_detail.js
document.addEventListener('DOMContentLoaded', function() {
    // --- Global Variables from Django Context (set in blog_detail.html) ---
    const USER_IS_AUTHENTICATED = window.USER_IS_AUTHENTICATED === 'true';
    const USER_FULL_NAME = window.USER_FULL_NAME || '';
    const USER_EMAIL = window.USER_EMAIL || '';

    // --- DOM Elements ---
    const commentsList = document.getElementById('comments-list');
    const commentForm = document.getElementById('comment-form');
    // Get postSlug and blogPostId from the commentForm action for consistency
    const blogPostId = commentForm ? commentForm.querySelector('input[name="post"]').value : null;
    const postSlug = commentForm ? commentForm.action.split('/').slice(-3, -2)[0] : null;
    
    const likeButton = document.querySelector('.like-button');
    const likeCountSpan = likeButton ? likeButton.querySelector('.like-count') : null;
    const commentsCountSpan = document.querySelector('.comments-count .count-value');

    const progressBar = document.getElementById('progress-bar');
    const backToTop = document.getElementById('back-to-top');

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
            }, 300); // Match CSS transition duration for fade-out
        }, 3000); // Display duration
    }

    // --- Helper function to get CSRF token ---
    function getCookie(name) {
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
        return cookieValue;
    }

    // --- Comment Form Submission (Main Form) ---
    if (commentForm) {
        commentForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const formData = new FormData(this);
            const submitButton = this.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.innerHTML;
            
            // Show loading state
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';

            // If user is authenticated, remove name/email from FormData
            // as they are handled by Django's User model and might be readOnly on frontend
            if (USER_IS_AUTHENTICATED) {
                formData.delete('name');
                formData.delete('email');
            }

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRFToken': getCookie('csrftoken') // Ensure CSRF token is sent
                    }
                });

                const result = await response.json();

                if (result.success) {
                    showToast('Comment posted successfully!', 'success');
                    const newCommentHtml = createCommentElement(result.comment);

                    // Update comment count
                    if (commentsCountSpan) {
                        commentsCountSpan.textContent = parseInt(commentsCountSpan.textContent || '0') + 1;
                    }

                    commentsList.insertAdjacentHTML('afterbegin', newCommentHtml);
                    
                    // If "No comments yet" message exists, remove it
                    const noCommentsMsg = document.querySelector('.no-comments');
                    if (noCommentsMsg) {
                        noCommentsMsg.remove();
                    }

                    this.reset(); // Clear form
                    // Hide any active reply forms (if open)
                    document.querySelectorAll('.comment-reply-form').forEach(form => form.style.display = 'none');

                    setupCommentReplies(); // Re-attach listeners for all buttons, including newly added
                } else {
                    if (result.errors) {
                        let errorMessages = '';
                        // Iterate through errors to build a user-friendly message
                        for (const field in result.errors) {
                            // You might want to map 'name' to 'Name' for better display
                            let fieldName = field.charAt(0).toUpperCase() + field.slice(1);
                            errorMessages += `${fieldName}: ${result.errors[field].join(', ')}\n`;
                        }
                        showToast(`Error: ${errorMessages.trim()}`, 'error');
                    } else {
                        showToast('Failed to post comment. Please try again.', 'error');
                    }
                }
            } catch (error) {
                console.error('Network or server error:', error);
                showToast('A network error occurred. Please try again.', 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
            }
        });
    }

    // --- Create Comment Element (HTML for new comments/replies) ---
    // This function generates the HTML structure for a comment, including its reply form.
    // The name/email inputs in the reply form are pre-filled/readonly based on JS global vars.
    function createCommentElement(commentData) {
        // Default attributes for anonymous users
        let nameInputRequired = '';
        let emailInputRequired = ''; // Email is optional
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
            // For anonymous users, 'name' is required, 'email' is optional
            nameInputRequired = 'required';
        }

        // Construct the full input HTML strings
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
                <div class="replies"></div> {# Container for nested replies #}
            </div>
        `;
    }

    // --- Handle comment reply buttons (Initial setup & Re-attach after AJAX) ---
    function setupCommentReplies() {
        // Remove existing listeners to prevent duplicates before re-adding
        document.querySelectorAll('.comment-reply').forEach(button => {
            button.removeEventListener('click', toggleReplyForm);
        });
        document.querySelectorAll('.comment-reply-form form').forEach(form => {
            form.removeEventListener('submit', submitReplyForm);
            form.querySelector('.cancel-reply').removeEventListener('click', hideReplyForm);
        });

        // Add new listeners
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

        if (!replyFormDiv) {
            console.error('Reply form container not found for comment ID:', commentId);
            return;
        }

        // Hide all other reply forms
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
            if (postInput) postInput.value = blogPostId; // Ensure correct blogPostId is passed
        }
    }

    // --- Submit Reply Form ---
    async function submitReplyForm(e) {
        e.preventDefault();
        const replyForm = e.target;
        const submitButton = replyForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.innerHTML;

        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';

        const formData = new FormData(replyForm);

        if (USER_IS_AUTHENTICATED) {
            formData.delete('name');
            formData.delete('email');
        }

        try {
            const response = await fetch(commentForm.action, { // Use main comment form action URL
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': getCookie('csrftoken')
                }
            });

            const result = await response.json();

            if (result.success) {
                showToast('Reply posted successfully!', 'success');
                const newReplyHtml = createCommentElement(result.comment);

                // Update comment count
                if (commentsCountSpan) {
                    commentsCountSpan.textContent = parseInt(commentsCountSpan.textContent || '0') + 1;
                }

                const parentCommentDiv = document.getElementById(`comment-${result.comment.parent_id}`);
                if (parentCommentDiv) {
                    let repliesContainer = parentCommentDiv.querySelector('.replies');
                    if (!repliesContainer) {
                        repliesContainer = document.createElement('div');
                        repliesContainer.className = 'replies';
                        parentCommentDiv.appendChild(repliesContainer);
                    }
                    repliesContainer.insertAdjacentHTML('beforeend', newReplyHtml);
                }
                replyForm.reset();
                replyForm.closest('.comment-reply-form').style.display = 'none';

                setupCommentReplies(); // Re-attach listeners for newly added replies
            } else {
                if (result.errors) {
                    let errorMessages = '';
                    for (const field in result.errors) {
                        let fieldName = field.charAt(0).toUpperCase() + field.slice(1);
                        errorMessages += `${fieldName}: ${result.errors[field].join(', ')}\n`;
                    }
                    showToast(`Error: ${errorMessages.trim()}`, 'error');
                } else {
                    showToast('Failed to post reply. Please try again.', 'error');
                }
            }
        } catch (error) {
            console.error('Network or server error:', error);
            showToast('A network error occurred. Please try again.', 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    }

    function hideReplyForm(e) {
        e.preventDefault();
        e.target.closest('.comment-reply-form').style.display = 'none';
    }

    // --- Table of Contents Generation ---
    function generateTOC() {
        const postContent = document.querySelector('.post-content');
        const tocList = document.getElementById('toc-list');
        if (!postContent || !tocList) return;

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
            const currentStackLevel = currentUlStack[currentUlStack.length - 1].dataset.level || 0;

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
                while (currentUlStack.length > 1 && level < (currentUlStack[currentUlStack.length - 1].dataset.level || 0)) {
                    currentUlStack.pop();
                }
                if (currentUlStack.length === 1 && level < (currentUlStack[0].dataset.level || 0)) {
                    currentUlStack[0].dataset.level = level; // Reset base level if going to a higher top-level heading
                }
                currentUlStack[currentUlStack.length - 1].appendChild(li);
            }
            li.classList.add(`toc-${heading.tagName.toLowerCase()}`);
        });
    }

    // --- Highlight active TOC item on scroll ---
    function highlightActiveTOCItem() {
        const postContent = document.querySelector('.post-content');
        if (!postContent) return;

        const observer = new IntersectionObserver((entries) => {
            let activeLinkFound = false;
            entries.forEach(entry => {
                const id = entry.target.id;
                const tocLink = document.querySelector(`#toc-list a[href="#${id}"]`);

                if (tocLink) {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                        document.querySelectorAll('#toc-list a').forEach(link => link.classList.remove('active'));
                        tocLink.classList.add('active');
                        activeLinkFound = true;

                        const tocContainer = document.querySelector('.toc-sidebar .toc-container');
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
                    const tocLink = document.querySelector(`#toc-list a[href="#${firstVisibleHeading.id}"]`);
                    if (tocLink && !tocLink.classList.contains('active')) {
                        document.querySelectorAll('#toc-list a').forEach(link => link.classList.remove('active'));
                        tocLink.classList.add('active');
                    }
                }
            }

        }, { threshold: [0, 0.1, 0.5, 0.9, 1] });

        document.querySelectorAll('.post-content h2[id], .post-content h3[id], .post-content h4[id]').forEach((section) => {
            observer.observe(section);
        });
    }

    // --- Smooth scroll for TOC links ---
    function setupTOCSmoothScroll() {
        document.querySelectorAll('#toc-list a').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.getAttribute('href');
                const targetElement = document.querySelector(targetId);

                if (targetElement) {
                    window.scrollTo({
                        top: targetElement.offsetTop - 100,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    // --- Reading Progress Indicator ---
    function setupReadingProgress() {
        if (!progressBar) return;
        
        window.addEventListener('scroll', () => {
            const windowHeight = window.innerHeight;
            const docHeight = document.documentElement.scrollHeight;
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const progress = (scrollTop / (docHeight - windowHeight)) * 100;
            
            progressBar.style.width = `${progress}%`;
        });
    }

    // --- Back to Top Button ---
    function setupBackToTop() {
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
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // --- Smooth Scroll for General Anchor Links ---
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
                    
                    window.scrollTo({ top: targetPosition, behavior: 'smooth' });
                    
                    if (history.pushState) {
                        history.pushState(null, null, targetId);
                    } else {
                        location.hash = targetId;
                    }
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
    }

    function fallbackCopyToClipboard(text, button) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            button.innerHTML = '<i class="fas fa-check"></i>';
            button.title = 'Copied!';
            showToast('Code copied to clipboard!', 'success');
            setTimeout(() => {
                button.innerHTML = '<i class="far fa-copy"></i>';
                button.title = 'Copy code';
            }, 2000);
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
            showToast('Failed to copy code. Please copy manually.', 'error');
        }
        document.body.removeChild(textArea);
    }

    // --- Social share functionality ---
    function setupSocialSharing() {
        document.querySelectorAll('.share-btn').forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                const url = encodeURIComponent(window.location.href);
                const title = encodeURIComponent(document.querySelector('h1').innerText);

                if (this.classList.contains('twitter')) {
                    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${title}`, '_blank', 'width=600,height=400');
                } else if (this.classList.contains('linkedin')) {
                    window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${url}&title=${title}`, '_blank', 'width=600,height=400');
                } else if (this.classList.contains('facebook')) {
                    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
                }
            });
        });
    }

    // --- Initialize animations ---
    function initAnimations() {
        const animateElements = [
            ...document.querySelectorAll('.related-card, .comment, .comment-form')
        ];

        animateElements.forEach((el, index) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = `opacity 0.5s ease ${index * 0.1}s, transform 0.5s ease ${index * 0.1}s`;
        });

        setTimeout(() => {
            animateElements.forEach(el => {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            });
        }, 100);

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, { threshold: 0.1 });

        animateElements.forEach(el => {
            observer.observe(el);
        });
    }

    // --- Like Button Logic ---
    if (likeButton) {
        likeButton.addEventListener('click', async function() {
            if (!USER_IS_AUTHENTICATED) {
                showToast('Please log in to like this post.', 'info');
                return;
            }
            
            const likeUrl = `/blog/${postSlug}/like/`;
            
            this.disabled = true;

            try {
                const response = await fetch(likeUrl, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': getCookie('csrftoken'),
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                });

                const data = await response.json();

                if (data.success) {
                    if (likeCountSpan) {
                        likeCountSpan.textContent = data.likes_count;
                    }

                    if (data.has_liked) {
                        this.classList.add('liked');
                        showToast(data.message, 'success');
                    } else {
                        this.classList.remove('liked');
                        showToast(data.message, 'info');
                    }
                } else {
                    showToast(data.message || 'Failed to process like. Please try again.', 'error');
                }
            } catch (error) {
                console.error('Error liking post:', error);
                showToast('A network error occurred while processing your like.', 'error');
            } finally {
                this.disabled = false;
            }
        });
    }

    // --- Main Initialization Function ---
    function initializeBlogDetailFeatures() {
        generateTOC();
        highlightActiveTOCItem();
        setupTOCSmoothScroll();
        setupCommentReplies(); // This function now handles initial and dynamic listeners
        setupCodeCopyButtons();
        setupSocialSharing();
        initAnimations();
        setupReadingProgress();
        setupBackToTop();
        setupSmoothScroll(); // For general anchor links
        // setupScrollToComments(); // Only if you have a button for this
        // setupCopyLinkButton();   // Only if you have a button for this
    }

    initializeBlogDetailFeatures();
});
