document.addEventListener('DOMContentLoaded', function() {
    // Animate the email preview in sequence
    const emailPreview = document.querySelector('.email-preview');
    if (emailPreview) {
        setTimeout(() => {
            emailPreview.style.opacity = '1';
        }, 300);
    }

    // Get CSS variable values
    const rootStyles = getComputedStyle(document.documentElement);
    const secondaryColor = rootStyles.getPropertyValue('--secondary-color').trim();
    const primaryColor = rootStyles.getPropertyValue('--primary-color').trim();

    // Add hover effect to detail cards
    const detailCards = document.querySelectorAll('.detail-card');
    detailCards.forEach((card, index) => {
        // Add delay to each card's animation
        card.style.transitionDelay = `${index * 0.1}s`;
        
        // Add hover effect
        card.addEventListener('mouseenter', () => {
            const icon = card.querySelector('i');
            icon.style.transform = 'scale(1.1)';
            icon.style.color = secondaryColor;
        });
        
        card.addEventListener('mouseleave', () => {
            const icon = card.querySelector('i');
            icon.style.transform = 'scale(1)';
            icon.style.color = primaryColor;
        });
    });

    // Add click animation to buttons
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            // Create ripple effect
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            this.appendChild(ripple);
            
            // Get click position
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Position ripple
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            
            // Remove ripple after animation
            setTimeout(() => {
                ripple.remove();
            }, 1000);
        });
    });

    // Add floating shapes animation
    const shapes = document.querySelectorAll('.shape');
    shapes.forEach(shape => {
        // Randomize initial position and animation duration
        const randomX = Math.random() * 20 - 10;
        const randomY = Math.random() * 20 - 10;
        const duration = 15 + Math.random() * 10;
        
        shape.style.transform = `translate(${randomX}px, ${randomY}px)`;
        shape.style.animationDuration = `${duration}s`;
    });
});