// main.js
// Ensure the DOM is fully loaded before running any JavaScript
document.addEventListener('DOMContentLoaded', function() {

    // --- 1. Navbar Scroll Effect ---
    const navbar = document.querySelector('.navbar');
    const heroSection = document.querySelector('.hero');
    const heroHeight = heroSection ? heroSection.offsetHeight : 100; // Use hero height or a default

    // Function to add/remove 'scrolled' class based on scroll position
    function handleScroll() {
        if (window.scrollY > heroHeight / 2) { // Add 'scrolled' after half of hero section is scrolled
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }

    // Add scroll event listener
    window.addEventListener('scroll', handleScroll);
    // Call once on load to set initial state in case user refreshes scrolled
    handleScroll();

    // --- 2. Hamburger Menu Functionality ---
    const hamburger = document.querySelector('.hamburger');
    const mobileMenu = document.querySelector('.mobile-menu');
    const navLinks = document.querySelectorAll('.mobile-menu a'); // Links inside the mobile menu
    const body = document.body; // To control body scrolling

    if (hamburger && mobileMenu) {
        // Toggle mobile menu and hamburger animation on click
        hamburger.addEventListener('click', function() {
            const isExpanded = mobileMenu.classList.contains('active');
            mobileMenu.classList.toggle('active');
            hamburger.classList.toggle('active'); // Add active class for potential hamburger icon animation
            body.classList.toggle('overflow-hidden'); // Prevent scrolling when menu is open
            hamburger.setAttribute('aria-expanded', !isExpanded); // Update ARIA attribute
        });

        // Close mobile menu when a navigation link is clicked
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                mobileMenu.classList.remove('active');
                hamburger.classList.remove('active');
                body.classList.remove('overflow-hidden');
                hamburger.setAttribute('aria-expanded', 'false');
            });
        });

        // Close mobile menu on window resize if it transitions to desktop view
        window.addEventListener('resize', function() {
            // Assuming your CSS breakpoint for mobile menu is 768px
            if (window.innerWidth > 768 && mobileMenu.classList.contains('active')) {
                mobileMenu.classList.remove('active');
                hamburger.classList.remove('active');
                body.classList.remove('overflow-hidden');
                hamburger.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // --- 3. Smooth Scrolling for Anchor Links ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        // Exclude the CV download link, which should perform a direct download
        if (anchor.getAttribute('href') === '#') {
            return; // Skip this link if it's just a placeholder '#'
        }
        if (anchor.classList.contains('btn') && anchor.textContent.includes('CV')) {
            return; // Skip CV download button
        }

        anchor.addEventListener('click', function (e) {
            e.preventDefault(); // Prevent default jump behavior

            const targetId = this.getAttribute('href').substring(1); // Get the ID without '#'
            const targetElement = document.getElementById(targetId);

            if (targetElement) {
                // Calculate offset for fixed navbar if it exists
                const navbarHeight = navbar ? navbar.offsetHeight : 0;
                const elementPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
                const offsetPosition = elementPosition - navbarHeight;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });


    // --- 4. Contact Form Submission with AJAX ---
    const contactForm = document.querySelector('.contact-form');
    // Assume you have a message box in your HTML for feedback, e.g.:
    // <div id="contact-form-message" class="message-box" style="display: none;"></div>
    const messageBox = document.getElementById('contact-form-message');

    function showFormMessage(message, type) {
        if (messageBox) {
            messageBox.textContent = message;
            messageBox.className = 'message-box ' + type; // Adds 'success' or 'error' class
            messageBox.style.display = 'block';
            messageBox.style.opacity = '1'; // Ensure it fades in if CSS transition is applied
            setTimeout(() => {
                messageBox.style.opacity = '0'; // Start fade out
                // Wait for transition to complete before hiding display
                setTimeout(() => {
                    messageBox.style.display = 'none';
                }, 500); // Assumes a 0.5s CSS transition for opacity
            }, 5000); // Hide after 5 seconds
        } else {
            console.warn('Message box element not found. Please add <div id="contact-form-message"> to your HTML.');
            alert(message); // Fallback to alert if message box doesn't exist
        }
    }


    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault(); // Prevent default form submission

            const formData = new FormData(this); // Get form data
            const formUrl = this.action || window.location.pathname; // Get form action URL

            const submitButton = this.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = 'Sending...';
            submitButton.disabled = true; // Disable button during submission

            try {
                const response = await fetch(formUrl, {
                    method: 'POST',
                    body: formData,
                });

                if (response.ok) {
                    const result = await response.json(); // Assuming Django sends back JSON response
                    if (result.success) {
                        showFormMessage('Message sent successfully! Thank you.', 'success');
                        this.reset(); // Clear the form
                    } else {
                        // Handle validation errors or other server-side issues
                        // result.message might contain a general error, or result.errors for specific field errors
                        let errorMessage = 'Something went wrong. Please try again.';
                        if (result.message) {
                            errorMessage = result.message;
                        } else if (result.errors) {
                            // If Django sends specific field errors, display them
                            errorMessage = Object.values(result.errors).map(err => err.join(' ')).join('\n');
                        }
                        showFormMessage('Error: ' + errorMessage, 'error');
                    }
                } else {
                    // Handle HTTP errors (e.g., 404, 500)
                    showFormMessage('Server error: ' + response.statusText + '. Please try again later.', 'error');
                }
            } catch (error) {
                console.error('Network or submission error:', error);
                showFormMessage('Could not send message. Please check your internet connection.', 'error');
            } finally {
                submitButton.textContent = originalButtonText;
                submitButton.disabled = false; // Re-enable button
            }
        });
    }

    // --- 5. Scroll-Based Animations (Fade-in sections) ---
    const sections = document.querySelectorAll('section');

    const observerOptions = {
        root: null, // viewport
        rootMargin: '0px',
        threshold: 0.1 // 10% of the section must be visible
    };

    const sectionObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in'); // Add a class to trigger fade-in
                observer.unobserve(entry.target); // Stop observing once it's visible
            }
        });
    }, observerOptions);

    sections.forEach(section => {
        // Exclude the hero section from the default hidden-for-animation class
        // as it might have its own initial animation or should be visible immediately
        if (!section.classList.contains('hero')) {
            section.classList.add('hidden-for-animation'); // Add initial hidden state for other sections
        }
        sectionObserver.observe(section);
    });

    // Add a specific class for initial hero section animation if desired,
    // or ensure it's visible by default without the 'hidden-for-animation' class.
    // Your current setup with 'fade-in-hero' is good for this.
    if (heroSection) {
        // This makes the hero section visible immediately or with a unique animation
        heroSection.classList.add('fade-in-hero');
    }
});