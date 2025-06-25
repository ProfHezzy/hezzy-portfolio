# portfolio/views.py
from django.shortcuts import render, get_object_or_404, redirect
from django.db.models import Q # For complex queries
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET
from django.core.mail import send_mail, EmailMultiAlternatives # For contact form email sending
from django.conf import settings # To access EMAIL_HOST_USER, etc.
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.contrib.auth.decorators import login_required # For like functionality
from django.contrib.auth import get_user_model # Ensure User is imported
from django.utils import timezone # For date handling
from taggit.models import Tag # Import Tag model for blog post tagging
from django.db.models import Q # For complex queries in blog filtering
from django.db import models # Import models for type hinting and validation
from django.template.loader import render_to_string
from django.urls import reverse

# Import all models from your portfolio app
from .models import (
    Skill, Project, Blog, Experience, Education, Certification, Award,
    Service, Testimonial, ContactInfo, SocialLink, SiteSetting, Comment, Message
)
# Import your forms
from .forms import ContactForm, CommentForm 

User = get_user_model() # Get the currently active user model


# --- Global Context Helper ---
def get_global_context():
    """
    Helper function to fetch site-wide settings and social links,
    typically needed on most pages.
    """
    site_settings = SiteSetting.objects.first() 
    if not site_settings:
        # Create a default SiteSetting if none exists, to prevent errors on first run
        site_settings = SiteSetting.objects.create(
            site_title="My Portfolio", 
            tagline="A Passionate Developer",
            about_me="A dedicated full-stack developer."
        )
    
    social_links = SocialLink.objects.filter(active=True).order_by('order')
    
    return {
        'site_settings': site_settings,
        'social_links': social_links,
    }


# --- Portfolio Core Views ---

@require_GET # Redundant decorator removed, only one is needed
def home(request):
    """Homepage view."""
    context = get_global_context() # Use the standardized helper
    
    context.update({
        'skills': Skill.objects.filter(featured=True).order_by('order'), # Only featured skills for home
        'projects': Project.objects.filter(featured=True, status='completed').order_by('-end_date')[:3], # Featured & completed
        'experiences': Experience.objects.all().order_by('-start_date'),
        'educations': Education.objects.all().order_by('-graduation_date'),
        'certifications': Certification.objects.all().order_by('-issue_date'),
        'awards': Award.objects.filter(featured=True).order_by('-date_received'), # Only featured awards for home
        'services': Service.objects.filter(featured=True).order_by('order'), # Only featured services for home
        'testimonials': Testimonial.objects.filter(featured=True).order_by('-date_given')[:3], # Featured testimonials
        'contact_info': ContactInfo.objects.first(), # Could be None if not created
        'latest_blog_posts': Blog.objects.filter(status='published').order_by('-published_at')[:3],
        'contact_form': ContactForm(), # For the contact form often on the homepage
    })
    
    return render(request, 'portfolio/index.html', context)


@require_GET
def about(request):
    """About page view."""
    context = get_global_context()
    context.update({
        'experiences': Experience.objects.all().order_by('-start_date'),
        'education': Education.objects.all().order_by('-graduation_date'),
        'skills': Skill.objects.all().order_by('category', 'order'),
        'certifications': Certification.objects.all().order_by('-issue_date'),
        'awards': Award.objects.all().order_by('-date_received'),
    })
    return render(request, 'portfolio/about.html', context)


@require_POST
def submit_contact_form(request):
    form = ContactForm(request.POST)
    if form.is_valid():
        name = form.cleaned_data['name']
        email = form.cleaned_data['email']
        subject = form.cleaned_data['subject'] or 'Portfolio Contact Form Submission'
        message_content = form.cleaned_data['message']

        # Save the message to the database
        Message.objects.create(
            name=name,
            email=email,
            subject=subject,
            message=message_content
        )

        # Prepare context for the email
        form_data = {
            'name': name,
            'email': email,
            'subject': subject,
            'message': message_content,
        }

        # Render HTML email content for the user
        email_html_content = render_to_string(
            'portfolio/contact_success_email.html',
            {'form_data': form_data}
        )

        try:
            # Send email to site owner (plain text)
            send_mail(
                subject,
                f"Name: {name}\nEmail: {email}\n\nMessage:\n{message_content}",
                settings.DEFAULT_FROM_EMAIL,
                [settings.CONTACT_EMAIL],
                fail_silently=False,
            )
            # Send confirmation email to user (HTML)
            email_message = EmailMultiAlternatives(
                "Thank you for contacting Hezekiah",
                "Thank you for contacting me! Here is a copy of your message.",  # fallback plain text
                settings.DEFAULT_FROM_EMAIL,
                [email],
            )
            email_message.attach_alternative(email_html_content, "text/html")
            email_message.send()

            # Return JSON success (no redirect)
            return JsonResponse({'success': True, 'message': 'Your message was sent successfully!'})
        except Exception as e:
            print(f"Error sending email: {e}")
            return JsonResponse({'success': False, 'message': 'Failed to send message. Please try again later.'}, status=500)
    else:
        return JsonResponse({'success': False, 'errors': form.errors}, status=400)


@require_GET
def email_success(request):
    form_data = request.session.get('contact_success_form_data', None)
    if form_data:
        del request.session['contact_success_form_data']
    return render(request, 'portfolio/contact_success_email.html', {'form_data': form_data})

# --- Projects Views ---

@require_GET
def projects_list(request): # Kept original name projects_list as in your urls/template
    """View to display a list of all projects."""
    context = get_global_context()
    project_list = Project.objects.filter(status='completed').order_by('-end_date') # Filter for completed projects
    
    paginator = Paginator(project_list, 9)
    page = request.GET.get('page')
    try:
        projects_paged = paginator.page(page)
    except PageNotAnInteger:
        projects_paged = paginator.page(1)
    except EmptyPage:
        projects_paged = paginator.page(paginator.num_pages)
    
    context['projects'] = projects_paged
    return render(request, 'portfolio/projects.html', context)


@require_GET
def project_detail(request, slug):
    """
    View to display a single project's details.
    """
    project = get_object_or_404(Project, slug=slug, status='completed') # Ensure project is completed
    context = get_global_context()

    # Fetch previous and next projects based on completion_date (end_date in model)
    # Using 'id' as a secondary sort to ensure consistent ordering for prev/next
    all_projects = Project.objects.filter(status='completed').order_by('end_date', 'id')
    project_list = list(all_projects)
    
    current_project_index = -1
    for i, p in enumerate(project_list):
        if p.id == project.id:
            current_project_index = i
            break

    previous_project = None
    next_project = None

    if current_project_index != -1:
        if current_project_index > 0:
            previous_project = project_list[current_project_index - 1]
        if current_project_index < len(project_list) - 1:
            next_project = project_list[current_project_index + 1]

    # Optional: If no prev/next, wrap around to loop through projects (e.g., from last to first, or first to last)
    # This creates an infinite loop of navigation. Adjust as per desired UX.
    if len(project_list) > 1: # Only wrap around if there's more than one project
        if not previous_project:
            previous_project = project_list[-1]
        if not next_project:
            next_project = project_list[0]

    # Fetch related projects (example: by common technologies, excluding current project)
    project_tech_ids = project.technologies.values_list('id', flat=True)
    related_projects = Project.objects.filter(
        technologies__id__in=project_tech_ids, status='completed'
    ).exclude(
        pk=project.pk 
    ).distinct().order_by('-end_date')[:3] 

    # If not enough related projects, fill with other recent completed projects
    if related_projects.count() < 3:
        remaining_count = 3 - related_projects.count()
        if remaining_count > 0:
            other_recent_projects = Project.objects.filter(status='completed').exclude(
                Q(pk=project.pk) | Q(id__in=[p.id for p in related_projects])
            ).order_by('-end_date')[:remaining_count]
            related_projects = list(related_projects) + list(other_recent_projects)


    context.update({
        'project': project,
        'previous_project': previous_project,
        'next_project': next_project,
        'related_projects': related_projects,
    })
    return render(request, 'portfolio/project_detail.html', context)

@require_GET
def projects_api(request):
    """
    API endpoint to return project data in JSON format for client-side use (e.g., projects.js).
    Supports basic client-side filtering and searching by returning all data
    and letting JavaScript handle the filtering.
    """
    projects_queryset = Project.objects.filter(status='completed').order_by('-end_date')

    projects_data = []
    for project in projects_queryset:
        # Access gallery images via the correct related_name
        gallery_images_urls = [img.image.url for img in project.gallery_images.all().order_by('order')]

        technology_names = [tech.name for tech in project.technologies.all()]

        # Use featured_image, fall back to first gallery image if available
        main_project_image_url = project.featured_image.url if project.featured_image else (gallery_images_urls[0] if gallery_images_urls else None)

        project_dict = {
            'id': project.id,
            'title': project.title,
            'slug': project.slug, # Include slug for direct linking
            'short_description': project.short_description, # Use short_description
            'description': project.description, # This is the property mapping to overview_content
            'full_description': project.overview_content, # This field is still in your model, include it
            'category': project.get_main_category,
            'completion_date': project.end_date.strftime('%B %Y') if project.end_date else (project.start_date.strftime('%B %Y') if project.start_date else None),
            'technologies': technology_names,
            'featured_image_url': main_project_image_url, # Renamed for clarity
            'gallery_images_urls': gallery_images_urls, # Renamed for clarity
            'live_url': project.live_demo_link, # Renamed to match template/model
            'github_url': project.github_link, # Renamed to match template/model
            'documentation_url': project.documentation_url,
            'key_features': project.key_features.strip().splitlines() if project.key_features else [], # Changed from 'features'
            'challenges_and_solutions': project.challenges_and_solutions or '', # Changed from 'challenges'
            'project_type': project.project_type,
            'client': project.client,
            'version': project.version,
            'seo_description': project.seo_description,
            'seo_keywords': project.seo_keywords,
            # Example for your API serialization:
            'main_image_url': project.featured_image.url if project.featured_image else '/static/images/default_project_image.jpg',
            # Optionally, provide an images array if you want a gallery:
            'images': [project.featured_image.url] if project.featured_image else [],
        }
        projects_data.append(project_dict)

    return JsonResponse(projects_data, safe=False)


# --- Blog Views ---

@require_GET
def blog_list(request): # Standardized name to blog_list
    """View to display a list of all published blog posts."""
    context = get_global_context()
    blog_posts_list = Blog.objects.filter(status='published').order_by('-published_at')

    # Apply tag filter if 'tag' parameter is present
    tag_slug = request.GET.get('tag')
    if tag_slug:
        tag = get_object_or_404(Tag, slug=tag_slug)
        blog_posts_list = blog_posts_list.filter(tags=tag)
        context['current_tag'] = tag

    # Apply search query filter if 'q' parameter is present
    query = request.GET.get('q')
    if query:
        blog_posts_list = blog_posts_list.filter(
            Q(title__icontains=query) |
            Q(content__icontains=query) |
            Q(excerpt__icontains=query) |
            Q(tags__name__icontains=query)
        ).distinct()
        context['search_query'] = query

    paginator = Paginator(blog_posts_list, 10)
    page = request.GET.get('page')
    try:
        posts_paged = paginator.page(page)
    except PageNotAnInteger:
        posts_paged = paginator.page(1)
    except EmptyPage:
        posts_paged = paginator.page(paginator.num_pages)
    
    context['blog_posts'] = posts_paged # Changed to 'blog_posts' for consistency
    context['all_tags'] = Tag.objects.all().order_by('name') # Pass all tags for tag cloud/filter
    return render(request, 'portfolio/blog.html', context)


@require_GET
def blog_detail(request, slug):
    """
    View for a specific blog post's details with comments and likes.
    This view also handles comment form submission for GET requests (initial display).
    """
    blog_post = get_object_or_404(Blog, slug=slug, status='published')
    context = get_global_context()

    # Increment post views (only on GET requests to avoid incrementing on form submissions)
    blog_post.views += 1
    blog_post.save()

    # Comments for this blog post (top-level and active)
    # Using 'replies' as related_name in Comment model, so prefetch that.
    comments = Comment.objects.filter(
        blog_post=blog_post, active=True, parent__isnull=True
    ).prefetch_related('replies').order_by('created_at') 

    # Pass request.user to the CommentForm instance for initial data and readonly fields
    comment_form = CommentForm(initial={'blog_post': blog_post.id}, user=request.user) 
    
    # Fetch related blog posts (e.g., by common tags)
    blog_tags_ids = blog_post.tags.values_list('id', flat=True)
    related_blogs = Blog.objects.filter(
        status='published'
    ).filter(
        tags__id__in=blog_tags_ids
    ).exclude(
        pk=blog_post.pk 
    ).distinct().order_by('-published_at')[:3]

    # If not enough related blogs, fill with other recent published blogs
    if related_blogs.count() < 3:
        remaining_count = 3 - related_blogs.count()
        if remaining_count > 0:
            other_recent_blogs = Blog.objects.filter(
                status='published'
            ).exclude(
                Q(pk=blog_post.pk) | Q(id__in=[b.id for b in related_blogs])
            ).order_by('-published_at')[:remaining_count]
            related_blogs = list(related_blogs) + list(other_recent_blogs)

    # Calculate total articles and total views for author bio (can be optimized with aggregation)
    total_articles = Blog.objects.filter(status='published').count()
    total_blog_views = Blog.objects.filter(status='published').aggregate(total_views=models.Sum('views'))['total_views'] or 0
    
    # Calculate years of experience (example - adjust logic based on your needs)
    # Assuming start_year in SiteSetting or calculated from first Experience
    years_experience = 0
    first_experience = Experience.objects.order_by('start_date').first()
    if first_experience:
        years_experience = timezone.now().year - first_experience.start_date.year


    context.update({
        'blog_post': blog_post, # Use 'blog_post' variable name consistently
        'comments': comments,
        'comment_form': comment_form, 
        'related_blogs': related_blogs,
        'has_user_liked': blog_post.liked_by.filter(id=request.user.id).exists() if request.user.is_authenticated else False, # Re-check like status
        'blog_post_count': total_articles, # For author bio
        'total_blog_views': total_blog_views, # For author bio
        'years_experience': years_experience, # For author bio
    })
    return render(request, 'portfolio/blog_detail.html', context)


@require_POST
def post_comment(request, slug): # This view processes the comment form submission
    """
    AJAX endpoint to handle comment submissions for blog posts.
    Expected to return JSON response.
    """
    blog_post = get_object_or_404(Blog, slug=slug, status='published')
    
    # Pass request.user to the CommentForm instance for proper validation and data saving
    form = CommentForm(request.POST, user=request.user) 
    
    if form.is_valid():
        comment = form.save(commit=False)
        # CRITICAL FIX: Assign to blog_post, not post
        comment.blog_post = blog_post 
        
        # Set author if user is authenticated, and ensure name/email are not redundantly saved for them
        if request.user.is_authenticated:
            comment.author = request.user
            comment.name = None # Clear name/email from form for authenticated users
            comment.email = None
        
        parent_id = form.cleaned_data.get('parent') # Get parent ID from cleaned data
        if parent_id:
            try:
                # Ensure parent comment belongs to the same blog post
                parent_comment = Comment.objects.get(pk=parent_id, blog_post=blog_post) 
                comment.parent = parent_comment
            except Comment.DoesNotExist:
                return JsonResponse({'success': False, 'errors': {'parent': ['Invalid parent comment.']}}, status=400)
        
        comment.save()

        # Return consistent data for JS to render
        return JsonResponse({
            'success': True,
            'comment': {
                'id': comment.id,
                'author': comment.get_author_name, # Property from model
                'content': comment.content,
                'created_at': comment.created_at.strftime('%b %d, %Y, %I:%M %p'), # Consistent date format
                'avatar_url': comment.get_avatar_url, # Property from model
                'parent_id': comment.parent.id if comment.parent else None,
            },
            'message': 'Comment posted successfully!'
        })
    else:
        # If form is not valid, return errors in a structured way (Django's default error format)
        return JsonResponse({'success': False, 'errors': form.errors}, status=400)


from django.db import transaction # Import transaction for atomicity
from django.views.decorators.csrf import csrf_protect # Import CSRF protection decorator
# --- Blog Post Liking ---
@require_POST
@csrf_protect # <--- ADD THIS DECORATOR!
def like_blog_post(request, slug):
    """
    Handles liking/unliking a blog post.
    Allows anonymous users to like.
    """
    blog_post = get_object_or_404(Blog, slug=slug) # Ensure 'Blog' is your actual model name

    # Check if the user (even anonymous) has 'liked' in their session
    # We'll store blog_post.id in the session list
    liked_posts_in_session = request.session.get('liked_posts', [])
    
    message = ''
    liked = False # Renamed from has_liked for consistency with JS expectation

    with transaction.atomic(): # Ensure likes_count is updated safely
        if blog_post.id in liked_posts_in_session:
            # User (session) has already liked, so unlike
            blog_post.likes_count = max(0, blog_post.likes_count - 1) # Ensure not negative
            liked_posts_in_session.remove(blog_post.id)
            message = 'Post unliked.'
            liked = False # Set to false as it's now unliked
        else:
            # User (session) has not liked, so like
            blog_post.likes_count += 1
            liked_posts_in_session.append(blog_post.id)
            message = 'Post liked successfully!'
            liked = True # Set to true as it's now liked

        blog_post.save()
        
        # Update the session with the modified list
        request.session['liked_posts'] = liked_posts_in_session
        request.session.modified = True # <--- ADD THIS LINE! Ensures session is saved.

    return JsonResponse({
        'success': True,
        'likes_count': blog_post.likes_count,
        'liked': liked, # <--- Renamed key to 'liked' to match frontend expectation
        'message': message
    })