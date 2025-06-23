// projects.js
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const projectsGrid = document.querySelector('.projects-grid');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const searchInput = document.querySelector('.search-input');
    const projectTemplate = document.getElementById('project-template');
    const projectModal = document.querySelector('.project-modal');
    const modalOverlay = document.querySelector('.modal-overlay');
    const modalContainer = document.querySelector('.modal-container');
    const modalCloseBtn = document.querySelector('.modal-close-btn');
    const prevImageBtn = document.querySelector('.modal-image-nav .prev-btn'); // New: Select prev/next buttons
    const nextImageBtn = document.querySelector('.modal-image-nav .next-btn');

    // Variables
    let allProjectsData = []; // This will store all projects fetched from the backend
    let activeFilter = 'all';
    let currentSearchTerm = '';
    let currentProject = null; // Stores the currently viewed project object in the modal
    let currentImageIndex = 0;

    // --- Initialization ---
    function init() {
        fetchProjects(); // Start by fetching projects
        setupEventListeners();
    }

    // --- Fetch Projects from Backend API ---
    async function fetchProjects() {
        projectsGrid.innerHTML = ''; // Clear grid before loading
        // Show loading state
        const loadingElement = document.createElement('div');
        loadingElement.className = 'project-loading';
        loadingElement.innerHTML = `
          <div class="loading-spinner"></div>
          <p>Loading projects...</p>
        `;
        projectsGrid.appendChild(loadingElement);

        try {
            // Adjust the fetch URL if you implement server-side filtering/searching
            // For now, fetching all and doing client-side filtering as per your initial JS
            const response = await fetch('/api/projects/'); // This is the API endpoint
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            allProjectsData = data; // Store all fetched projects globally
            filterProjects(); // Apply initial filter (all) and render
        } catch (error) {
            console.error('Error fetching projects:', error);
            projectsGrid.innerHTML = `
                <div class="no-projects error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Failed to load projects</h3>
                    <p>Please try again later. Error: ${error.message}</p>
                </div>
            `;
        }
    }

    // --- Render Projects to the Grid ---
    function renderProjects(projectsToRender) {
        // Clear the grid and remove loading spinner
        projectsGrid.innerHTML = '';

        // Simulate loading delay for better UX (optional, but good for local dev)
        setTimeout(() => {
            if (projectsToRender.length === 0) {
                projectsGrid.innerHTML = `
                    <div class="no-projects">
                        <i class="fas fa-folder-open"></i>
                        <h3>No projects found</h3>
                        <p>Try adjusting your filters or search term.</p>
                    </div>
                `;
                return;
            }

            // Create a container for the grid if it doesn't exist or is empty
            let gridContainer = projectsGrid.querySelector('.projects-grid-container');
            if (!gridContainer) {
                gridContainer = document.createElement('div');
                gridContainer.className = 'projects-grid-container';
                projectsGrid.appendChild(gridContainer);
            } else {
                gridContainer.innerHTML = ''; // Clear existing cards if container already there
            }

            // Add each project to the grid
            projectsToRender.forEach((project, index) => {
                const projectElement = createProjectElement(project); // Pass project data
                gridContainer.appendChild(projectElement);
                // Add animation delay based on index for staggered effect
                projectElement.style.animationDelay = `${index * 0.1}s`;
            });
        }, 300); // Reduced delay for smoother feel
    }

    // --- Create a Project Card Element ---
    function createProjectElement(project) {
        const clone = projectTemplate.content.cloneNode(true);
        const projectCard = clone.querySelector('.project-card');
        const projectImageDiv = clone.querySelector('.project-image'); // This is the div
        const projectTitle = clone.querySelector('.project-title');
        const projectDescription = clone.querySelector('.project-description');
        const projectTechContainer = clone.querySelector('.project-tech');
        const liveLink = clone.querySelector('.project-link:first-child');
        const codeLink = clone.querySelector('.project-link:last-child');

        // Set project data attributes for filtering
        projectCard.dataset.id = project.id;
        projectCard.dataset.category = project.category || 'other'; // Use derived category or default
        projectCard.dataset.tech = project.technologies.join(', ').toLowerCase(); // For search on technologies

        // Set image (use the first image from gallery or fallback to main image)
        const imageUrl = (project.images && project.images.length > 0) ? project.images[0] : project.main_image_url;
        if (imageUrl) {
            projectImageDiv.style.backgroundImage = `url(${imageUrl})`;
            projectImageDiv.style.backgroundSize = 'cover';
            projectImageDiv.style.backgroundPosition = 'center';
        } else {
            // Fallback for missing image, e.g., a placeholder image
            projectImageDiv.style.backgroundImage = `url('https://placehold.co/600x400/cccccc/333333?text=No+Image')`;
            projectImageDiv.style.backgroundSize = 'cover';
            projectImageDiv.style.backgroundPosition = 'center';
        }

        // Set title and short description
        projectTitle.textContent = project.title;
        projectDescription.textContent = project.description; // 'description' is short_description from model

        // Add technology tags
        projectTechContainer.innerHTML = ''; // Clear any template default
        project.technologies.forEach(tech => {
            const techTag = document.createElement('span');
            techTag.className = 'tech-tag';
            techTag.textContent = tech;
            projectTechContainer.appendChild(techTag);
        });

        // Set links (hide if not available)
        if (project.live_url) {
            liveLink.href = project.live_url;
            liveLink.style.display = 'inline-flex';
        } else {
            liveLink.style.display = 'none';
        }

        if (project.codeUrl) {
            codeLink.href = project.codeUrl;
            codeLink.style.display = 'inline-flex';
        } else {
            codeLink.style.display = 'none';
        }

        // Add click event to view details button and entire card
        const viewDetailsBtn = clone.querySelector('.view-details-btn');
        viewDetailsBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click from firing if button clicked
            openProjectModal(project.id);
        });

        projectCard.addEventListener('click', (e) => {
            // Only open modal if not clicking on the specific links/buttons within the card
            if (!e.target.closest('.project-link') && !e.target.closest('.view-details-btn')) {
                openProjectModal(project.id);
            }
        });

        return projectCard;
    }

    // --- Filter Projects based on active filter and search term ---
    function filterProjects() {
        let filteredProjects = [...allProjectsData];

        // Apply category filter
        if (activeFilter !== 'all') {
            filteredProjects = filteredProjects.filter(project => {
                // The `project.category` should come from your backend API response
                // (which is derived using `get_main_category` property in models.py)
                return project.category === activeFilter; 
            });
        }

        // Apply search filter (client-side)
        if (currentSearchTerm) {
            const searchTerm = currentSearchTerm.toLowerCase();
            filteredProjects = filteredProjects.filter(project => {
                return (
                    project.title.toLowerCase().includes(searchTerm) ||
                    project.description.toLowerCase().includes(searchTerm) ||
                    project.full_description.toLowerCase().includes(searchTerm) || // Search full description too
                    project.technologies.some(tech => tech.toLowerCase().includes(searchTerm))
                );
            });
        }
        renderProjects(filteredProjects);
    }

    // --- Open Project Modal with details ---
    function openProjectModal(projectId) {
        currentProject = allProjectsData.find(p => p.id === projectId);
        if (!currentProject) return;

        currentImageIndex = 0; // Reset image index when opening a new modal

        // Populate modal content
        document.querySelector('.modal-title').textContent = currentProject.title;
        document.querySelector('.modal-date').textContent = currentProject.date; // Ensure date is formatted correctly in JSON
        document.querySelector('.modal-category').textContent = currentProject.category;
        document.querySelector('.modal-description').innerHTML = currentProject.full_description; // Use innerHTML for rich text

        // Set links
        const liveLink = document.querySelector('.modal-link.live-link');
        const codeLink = document.querySelector('.modal-link.code-link');

        if (currentproject.live_url) {
            liveLink.href = currentproject.live_url;
            liveLink.style.display = 'inline-flex';
        } else {
            liveLink.style.display = 'none';
        }

        if (currentProject.codeUrl) {
            codeLink.href = currentProject.codeUrl;
            codeLink.style.display = 'inline-flex';
        } else {
            codeLink.style.display = 'none';
        }

        // Set technologies
        const techTagsContainer = document.querySelector('.modal-tech .tech-tags');
        techTagsContainer.innerHTML = '';
        currentProject.technologies.forEach(tech => {
            const tag = document.createElement('span');
            tag.className = 'modal-tech-tag';
            tag.textContent = tech;
            techTagsContainer.appendChild(tag);
        });

        // Set features
        const featuresList = document.querySelector('.features-list');
        featuresList.innerHTML = '';
        if (currentProject.key_features && Array.isArray(currentProject.key_features)) {
            currentProject.key_features.forEach(feature => {
                const li = document.createElement('li');
                li.textContent = feature.trim();
                featuresList.appendChild(li);
            });
        }

        // Set challenges
        document.querySelector('.challenges-content').innerHTML = currentProject.challenges_and_solutions || '';

        // Set up image gallery
        setupImageGallery(currentProject.images);

        // Show modal
        projectModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent body scroll
    }

    // --- Set up image gallery in modal ---
    function setupImageGallery(images) {
        const thumbnailsContainer = document.querySelector('.modal-thumbnails');
        thumbnailsContainer.innerHTML = '';

        if (!images || images.length === 0) {
            // Handle case with no gallery images
            thumbnailsContainer.style.display = 'none';
            prevImageBtn.style.display = 'none';
            nextImageBtn.style.display = 'none';
            document.querySelector('.modal-image').src = currentProject.main_image_url || 'https://placehold.co/600x400/cccccc/333333?text=No+Image';
            return;
        }

        thumbnailsContainer.style.display = 'flex'; // Ensure visible
        prevImageBtn.style.display = images.length > 1 ? 'flex' : 'none'; // Show only if more than 1 image
        nextImageBtn.style.display = images.length > 1 ? 'flex' : 'none';

        images.forEach((image, index) => {
            const thumbnail = document.createElement('div');
            thumbnail.className = 'thumbnail-item';
            if (index === currentImageIndex) {
                thumbnail.classList.add('active');
            }
            thumbnail.innerHTML = `<img src="${image}" alt="Thumbnail ${index + 1}">`;
            thumbnail.addEventListener('click', () => {
                currentImageIndex = index;
                updateModalImage();
            });
            thumbnailsContainer.appendChild(thumbnail);
        });

        // Ensure current image is set
        updateModalImage();
    }

    // --- Update modal image when navigating ---
    function updateModalImage() {
        if (!currentProject || !currentProject.images || currentProject.images.length === 0) {
            return; // No images to update
        }
        document.querySelector('.modal-image').src = currentProject.images[currentImageIndex];

        // Update active thumbnail
        document.querySelectorAll('.thumbnail-item').forEach((thumb, index) => {
            if (index === currentImageIndex) {
                thumb.classList.add('active');
            } else {
                thumb.classList.remove('active');
            }
        });
    }

    // --- Close project modal ---
    function closeProjectModal() {
        projectModal.classList.remove('active');
        document.body.style.overflow = ''; // Restore body scroll

        // Reset modal scroll position after animation
        setTimeout(() => {
            modalContainer.scrollTop = 0;
            // Optionally, reset currentProject or currentImageIndex here if needed
        }, 300);
    }

    // --- Set up event listeners ---
    function setupEventListeners() {
        // Filter buttons
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                activeFilter = button.dataset.filter;
                filterProjects();
            });
        });

        // Search input
        searchInput.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value.trim();
            filterProjects();
        });

        // Modal close button and overlay
        modalCloseBtn.addEventListener('click', closeProjectModal);
        modalOverlay.addEventListener('click', closeProjectModal);

        // Image navigation buttons (ensure listeners are added after they are selected)
        prevImageBtn.addEventListener('click', () => {
            currentImageIndex = (currentImageIndex - 1 + currentProject.images.length) % currentProject.images.length;
            updateModalImage();
        });
        nextImageBtn.addEventListener('click', () => {
            currentImageIndex = (currentImageIndex + 1) % currentProject.images.length;
            updateModalImage();
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && projectModal.classList.contains('active')) {
                closeProjectModal();
            }
        });

        // Prevent modal container click from closing modal (important for clicks inside modal)
        modalContainer.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Smooth scrolling for hero section internal links (if any, adjust if already handled by main.js)
        document.querySelectorAll('.hero-scroll a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                document.querySelector(this.getAttribute('href')).scrollIntoView({
                    behavior: 'smooth',
                    block: 'start' // Ensure it scrolls to the top of the section
                });
            });
        });
    }

    // Initialize the page
    init();
});
