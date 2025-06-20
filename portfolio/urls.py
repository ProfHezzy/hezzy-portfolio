# portfolio/urls.py
from django.urls import path
from . import views

urlpatterns = [
    # --- Main Landing Page ---
    path('', views.home, name='home'),

    # --- Projects Section ---
    path('projects/', views.projects_list, name='projects'),
    path('api/projects/', views.projects_api, name='projects_api'),
    path('projects/<slug:slug>/', views.project_detail, name='project_detail'),

    # --- Blog Section ---
    path('blog/', views.blog, name='blog'),
    path('blog/<slug:slug>/', views.blog_detail, name='blog_detail'),
    path('blog/<slug:slug>/comment/', views.post_comment, name='post_comment'),
    
    # NEW: URL for liking/unliking a blog post
    path('blog/<slug:slug>/like/', views.like_post, name='like_post'),

    # --- Contact Form (AJAX Endpoint) ---
    path('contact/', views.contact, name='contact'),

]
