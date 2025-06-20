# portfolio/views.py
from django.shortcuts import render, get_object_or_404
from .models import (
    Skill, Project, Blog, Experience, Education, Certification, Award,
    Service, Testimonial, ContactInfo, SocialLink, SiteSetting, Comment, Message, User # Ensure User is imported
)
from .forms import ContactForm, CommentForm
from django.core.mail import send_mail
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.db.models import Q
from django.contrib.auth.decorators import login_required # NEW: For like functionality

# Define a default avatar URL. Ensure this path exists in your static files.
DEFAULT_AVATAR_URL = '/static/images/default_user_avatar.jpg'


def get_common_context():
    """Helper function to fetch site-wide settings."""
    return {'site_settings': SiteSetting.objects.first() or SiteSetting()}

@require_GET
@require_GET
def home(request):
    # ... (your existing home view) ...
    context = get_common_context()
    
    context['skills'] = Skill.objects.all().order_by('order')
    context['projects'] = Project.objects.filter(featured=True).order_by('-created_at')[:3]
    context['experiences'] = Experience.objects.all().order_by('-start_date')
    context['educations'] = Education.objects.all().order_by('-graduation_date')
    context['certifications'] = Certification.objects.all().order_by('-issue_date')
    context['awards'] = Award.objects.all().order_by('-date_received')
    context['services'] = Service.objects.all().order_by('order')
    context['testimonials'] = Testimonial.objects.all().order_by('-featured', '-date_given')
    context['contact_info'] = ContactInfo.objects.first() or ContactInfo()
    context['social_links'] = SocialLink.objects.filter(active=True).order_by('order')

    context['latest_blog_posts'] = Blog.objects.filter(status='published').order_by('-published_at')[:3]

    context['contact_form'] = ContactForm() 
    
    return render(request, 'portfolio/index.html', context)


@require_GET
def projects_list(request):
    # ... (your existing projects_list view) ...
    context = get_common_context()
    project_list = Project.objects.all().order_by('-created_at')
    
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
    # ... (your existing project_detail view) ...
    context = get_common_context()
    project = get_object_or_404(Project, slug=slug)
    context['project'] = project
    context['related_projects'] = Project.objects.filter(
        technologies__in=project.technologies.all()
    ).exclude(pk=project.pk).distinct().order_by('-created_at')[:3]
    return render(request, 'portfolio/project_detail.html', context)

@require_GET
def blog(request):
    # ... (your existing blog view) ...
    context = get_common_context()
    post_list = Blog.objects.filter(status='published').order_by('-published_at')

    paginator = Paginator(post_list, 10)
    page = request.GET.get('page')
    try:
        posts_paged = paginator.page(page)
    except PageNotAnInteger:
        posts_paged = paginator.page(1)
    except EmptyPage:
        posts_paged = paginator.page(paginator.num_pages)
    
    context['posts'] = posts_paged
    return render(request, 'portfolio/blog.html', context)

@require_GET
def blog_detail(request, slug):
    """View for a specific blog post's details with comments and likes."""
    context = get_common_context()
    post = get_object_or_404(Blog, slug=slug, status='published')
    
    # Retrieve comments that are not replies (parent is null)
    # Then prefetch their replies to reduce database queries for nested comments
    comments = Comment.objects.filter(
        post=post, active=True, parent__isnull=True
    ).prefetch_related('replies').order_by('created_at') # Order by oldest first for display

    context['post'] = post
    context['comments'] = comments
    
    # Pass request.user to the CommentForm instance
    context['comment_form'] = CommentForm(initial={'post': post.id}, user=request.user) # <--- IMPORTANT CHANGE
    
    context['related_posts'] = Blog.objects.filter(
        tags__in=post.tags.all(), status='published'
    ).exclude(pk=post.pk).distinct().order_by('-published_at')[:3]

    context['social_links'] = SocialLink.objects.filter(active=True).order_by('order')

    # Determine if the current user has liked this post
    has_user_liked = False
    if request.user.is_authenticated:
        has_user_liked = post.liked_by.filter(id=request.user.id).exists()
    context['has_user_liked'] = has_user_liked

    return render(request, 'portfolio/blog_detail.html', context)

@require_POST
def post_comment(request, slug):
    """
    AJAX endpoint to handle comment submissions.
    Expected to return JSON response.
    """
    post = get_object_or_404(Blog, slug=slug, status='published')
    
    # Pass request.user to the CommentForm instance
    form = CommentForm(request.POST, user=request.user) # <--- IMPORTANT CHANGE
    
    if form.is_valid():
        comment = form.save(commit=False)
        comment.post = post 
        
        # Set author if user is authenticated, and nullify name/email if they exist
        if request.user.is_authenticated:
            comment.author = request.user
            comment.name = None # Ensure name/email from form are not saved if user is authenticated
            comment.email = None
        
        parent_id = request.POST.get('parent')
        if parent_id:
            try:
                parent_comment = Comment.objects.get(pk=parent_id, post=post)
                comment.parent = parent_comment
            except Comment.DoesNotExist:
                return JsonResponse({'success': False, 'errors': {'parent': ['Invalid parent comment.']}}, status=400)
        
        comment.save()

        # Return consistent data for JS to render
        return JsonResponse({
            'success': True,
            'comment': {
                'id': comment.id,
                'author': comment.get_author_name,
                'content': comment.content,
                'created_at': comment.created_at.strftime('%b %d, %Y, %I:%M %p'),
                'avatar_url': comment.get_avatar_url,
                'parent_id': comment.parent.id if comment.parent else None,
            },
            'message': 'Comment posted successfully!'
        })
    else:
        # If form is not valid, return errors in a structured way
        return JsonResponse({'success': False, 'errors': form.errors}, status=400)


@require_POST
def like_post(request, slug):
    # ... (your existing like_post view) ...
    post = get_object_or_404(Blog, slug=slug, status='published')

    user = request.user
    has_liked = False
    if post.liked_by.filter(id=user.id).exists():
        post.liked_by.remove(user)
        message = 'Post unliked.'
        has_liked = False
    else:
        post.liked_by.add(user)
        message = 'Post liked successfully!'
        has_liked = True
    
    return JsonResponse({
        'success': True,
        'likes_count': post.likes_count,
        'has_liked': has_liked,
        'message': message
    })


@require_POST
def contact(request):
    """
    AJAX endpoint for handling contact form submissions from the landing page.
    Returns JSON response.
    """
    form = ContactForm(request.POST)
    if form.is_valid():
        name = form.cleaned_data['name']
        email = form.cleaned_data['email']
        subject = form.cleaned_data['subject'] or 'Portfolio Contact Form Submission'
        message_content = form.cleaned_data['message']
        
        Message.objects.create(
            name=name,
            email=email,
            subject=subject,
            message=message_content
        )

        try:
            send_mail(
                subject,
                f"Name: {name}\nEmail: {email}\n\nMessage:\n{message_content}",
                settings.DEFAULT_FROM_EMAIL,
                [settings.CONTACT_EMAIL],
                fail_silently=False,
            )
            return JsonResponse({'success': True, 'message': 'Message sent successfully!'}, status=200)
        except Exception as e:
            print(f"Error sending email: {e}")
            return JsonResponse({'success': False, 'message': 'Failed to send message. Please try again later.'}, status=500)
    else:
        return JsonResponse({'success': False, 'errors': form.errors}, status=400)


@require_GET
def projects_api(request):
    """
    API endpoint to return project data in JSON format for projects.js.
    Supports basic client-side filtering and searching by returning all data
    and letting JavaScript handle the filtering.
    For very large datasets, server-side filtering would be more efficient.
    """
    projects_queryset = Project.objects.filter(status='completed').order_by('-created_at')

    projects_data = []
    for project in projects_queryset:
        gallery_images_urls = [img.image.url for img in project.gallery_images.all()]

        technology_names = [tech.name for tech in project.technologies.all()]

        main_project_image_url = project.image.url if project.image else (gallery_images_urls[0] if gallery_images_urls else None)

        project_dict = {
            'id': project.id,
            'title': project.title,
            'description': project.description,
            'full_description': project.full_description,
            'category': project.get_main_category,
            'date': project.end_date.strftime('%B %Y') if project.end_date else project.start_date.strftime('%B %Y'),
            'technologies': technology_names,
            'main_image_url': main_project_image_url,
            'images': gallery_images_urls,
            'liveUrl': project.live_demo_link,
            'codeUrl': project.github_link,
            'features': project.key_features.strip().splitlines() if project.key_features else [],
            'challenges': project.challenges_and_solutions or '',
        }
        projects_data.append(project_dict)

    return JsonResponse(projects_data, safe=False)
