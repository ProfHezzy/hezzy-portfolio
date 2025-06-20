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
            mobileMenu.classList.toggle('active');
            hamburger.classList.toggle('active'); // Add active class for potential hamburger icon animation
            body.classList.toggle('overflow-hidden'); // Prevent scrolling when menu is open
        });

        // Close mobile menu when a navigation link is clicked
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                mobileMenu.classList.remove('active');
                hamburger.classList.remove('active');
                body.classList.remove('overflow-hidden');
            });
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
                    // Django's CSRF token is handled by FormData automatically for forms with method POST.
                    // If you were sending JSON, you'd need to manually add the X-CSRFToken header.
                    // For now, it's fine as Django forms expect x-www-form-urlencoded or multipart/form-data.
                });

                if (response.ok) {
                    const result = await response.json(); // Assuming Django sends back JSON response
                    if (result.success) {
                        alert('Message sent successfully! Thank you.'); // Use a custom modal for production
                        this.reset(); // Clear the form
                    } else {
                        // Handle validation errors or other server-side issues
                        alert('Error: ' + (result.message || 'Something went wrong. Please try again.')); // Use a custom modal
                    }
                } else {
                    // Handle HTTP errors (e.g., 404, 500)
                    alert('Server error: ' + response.statusText + '. Please try again later.'); // Use a custom modal
                }
            } catch (error) {
                console.error('Network or submission error:', error);
                alert('Could not send message. Please check your internet connection.'); // Use a custom modal
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
        section.classList.add('hidden-for-animation'); // Add initial hidden state
        sectionObserver.observe(section);
    });

    // Add a small delay for the hero section animation if needed
    if (heroSection) {
        heroSection.classList.add('fade-in-hero');
    }
});
