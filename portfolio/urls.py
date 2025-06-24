# portfolio/urls.py
from django.urls import path
from . import views # Import all views from portfolio/views.py

urlpatterns = [
    # Core Portfolio URLs
    path('', views.home, name='home'), # Renamed from index to home for clarity
    path('about/', views.about, name='about'),
    path('contact/', views.contact_page, name='contact'), # Renamed for GET request (displaying form)
    path('contact/submit/', views.submit_contact_form, name='submit_contact_form'), # For AJAX POST submission

    # Projects URLs
    path('projects/', views.projects_list, name='projects'), # List all projects
    path('projects/<slug:slug>/', views.project_detail, name='project_detail'), # Individual project detail
    path('api/projects/', views.projects_api, name='projects_api'), # New API endpoint for projects data

    # Blog URLs
    path('blog/', views.blog_list, name='blog_list'), # List all blog posts
    path('blog/<slug:slug>/', views.blog_detail, name='blog_detail'), # Individual blog post detail
    path('blog/<slug:slug>/like/', views.like_blog_post, name='like_blog_post'), # Like/Unlike blog post
    path('blog/<slug:slug>/comment/', views.post_comment, name='post_comment'), # Post a comment (handled by post_comment view)
]
