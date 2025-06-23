# portfolio/admin.py
from django.contrib import admin
from django.utils.html import format_html # Import format_html for image_tag
from django.utils import timezone # Import timezone for admin actions

from .models import (
    Skill, Project, ProjectImage, Blog, Comment,
    Experience, Education, Certification, Award, Service,
    Testimonial, ContactInfo, SocialLink, SiteSetting, Message
)

# --- Inlines for related models ---
class ProjectImageInline(admin.TabularInline):
    model = ProjectImage
    extra = 1
    # If you want to display image in inline
    fields = ('image', 'caption', 'order', 'image_preview')
    readonly_fields = ('image_preview',)

    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px;" />'.format(obj.image.url))
        return "No Image"
    image_preview.short_description = 'Preview'


class CommentInline(admin.TabularInline):
    model = Comment
    extra = 0
    fields = ('author', 'name', 'email', 'content', 'parent', 'active', 'created_at')
    readonly_fields = ('created_at',)


# --- Model Admin Classes ---

@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'proficiency', 'order', 'featured')
    list_filter = ('category', 'featured')
    search_fields = ('name', 'description')
    list_editable = ('order', 'featured', 'proficiency')


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = (
        'title', 'slug', 'end_date', 'project_type',
        'status', 'featured', 'live_demo_link', 'github_link'
    )
    list_filter = ('end_date', 'project_type', 'status', 'featured', 'technologies__name')
    search_fields = ('title', 'short_description', 'overview_content')
    prepopulated_fields = {'slug': ('title',)}
    date_hierarchy = 'end_date'

    fieldsets = (
        (None, {
            'fields': (
                'title', 'slug', 'short_description', 'overview_content',
                'featured_image', 'thumbnail', 'technologies', 'status', 'featured'
            ),
        }),
        ('Dates', {
            'fields': ('start_date', 'end_date'),
            'classes': ('collapse',),
        }),
        ('Details & Context', {
            'fields': ('project_type', 'client', 'version'),
            'classes': ('collapse',),
        }),
        ('Key Features & Challenges', {
            'fields': ('key_features', 'challenges_and_solutions'),
            'classes': ('collapse',),
            'description': "Highlight key functionalities and discuss problems faced and their solutions."
        }),
        ('Project Links', {
            'fields': ('live_demo_link', 'github_link', 'documentation_url'),
            'classes': ('collapse',),
        }),
        ('SEO Options', {
            'fields': ('seo_description', 'seo_keywords'),
            'classes': ('collapse',),
            'description': "Meta tags for search engine optimization. Fill these carefully for better search visibility."
        }),
    )

    inlines = [ProjectImageInline]


@admin.register(ProjectImage)
class ProjectImageAdmin(admin.ModelAdmin):
    list_display = ('project', 'image_tag', 'caption', 'order')
    list_filter = ('project',)
    search_fields = ('project__title', 'caption')
    list_editable = ('order',)

    def image_tag(self, obj):
        if obj.image:
            return format_html('<img src="{}" style="width: 45px; height: 45px; object-fit: cover; border-radius: 4px;" />'.format(obj.image.url))
        return "No Image"
    image_tag.short_description = 'Image'


@admin.register(Blog)
class BlogAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'status', 'published_at', 'created_at', 'likes_count', 'views')
    list_filter = ('status', 'published_at')
    search_fields = ('title', 'content', 'excerpt')
    prepopulated_fields = {'slug': ('title',)}
    date_hierarchy = 'published_at'
    actions = ['make_published', 'make_draft'] # Added admin actions

    fieldsets = (
        (None, {
            'fields': ('title', 'slug', 'content', 'excerpt', 'featured_image', 'tags'),
        }),
        ('Publication', {
            'fields': ('status', 'published_at'),
            'classes': ('collapse',),
        }),
        ('Metadata & Stats', {
            'fields': ('views', 'liked_by'), # liked_by will be a raw_id_field
            'classes': ('collapse',),
        }),
    )
    raw_id_fields = ('liked_by',) # Ensures good performance for many users

    inlines = [CommentInline]

    def make_published(self, request, queryset):
        # Only set published_at if it's not already set
        queryset.filter(published_at__isnull=True).update(published_at=timezone.now())
        queryset.update(status='published')
    make_published.short_description = "Mark selected blog posts as published"

    def make_draft(self, request, queryset):
        queryset.update(status='draft')
    make_draft.short_description = "Mark selected blog posts as draft"


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('get_author_name', 'blog_post', 'content_preview', 'created_at', 'active', 'is_reply')
    list_filter = ('active', 'blog_post')
    search_fields = ('name', 'email', 'content', 'blog_post__title')
    actions = ['approve_comments', 'disapprove_comments']
    list_editable = ('active',) # Allows quick toggle of active status
    readonly_fields = ('created_at',) # Prevent accidental changes to creation date
    raw_id_fields = ('blog_post', 'author', 'parent') # Good for performance if many related objects

    def get_author_name(self, obj):
        return obj.get_author_name
    get_author_name.short_description = 'Author'

    def content_preview(self, obj):
        # Display first 50 chars of content
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Content'

    def approve_comments(self, request, queryset):
        queryset.update(active=True)
    approve_comments.short_description = "Mark selected comments as active"

    def disapprove_comments(self, request, queryset):
        queryset.update(active=False)
    disapprove_comments.short_description = "Mark selected comments as inactive"


@admin.register(Experience)
class ExperienceAdmin(admin.ModelAdmin):
    list_display = ('title', 'company', 'start_date', 'end_date', 'current', 'employment_type')
    list_filter = ('employment_type', 'current')
    search_fields = ('title', 'company', 'description')
    filter_horizontal = ('skills',)


@admin.register(Education)
class EducationAdmin(admin.ModelAdmin):
    list_display = ('degree', 'institution', 'graduation_date', 'currently_attending')
    list_filter = ('currently_attending',)
    search_fields = ('degree', 'institution', 'major')


@admin.register(Certification)
class CertificationAdmin(admin.ModelAdmin):
    list_display = ('name', 'issuing_organization', 'issue_date', 'expiry_date', 'is_expired')
    list_filter = ('issuing_organization', 'issue_date')
    search_fields = ('name', 'issuing_organization')
    filter_horizontal = ('skills',)


@admin.register(Award)
class AwardAdmin(admin.ModelAdmin):
    list_display = ('name', 'awarding_organization', 'date_received', 'featured')
    list_filter = ('featured',)
    search_fields = ('name', 'awarding_organization')


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'featured', 'order', 'icon') # Added 'icon' to list_display
    list_editable = ('featured', 'order', 'icon') # 'icon' can be edited directly
    search_fields = ('name', 'description')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Testimonial)
class TestimonialAdmin(admin.ModelAdmin):
    list_display = ('name', 'company', 'rating', 'featured', 'date_given')
    list_filter = ('featured', 'rating')
    search_fields = ('name', 'company', 'testimonial_text')
    list_editable = ('featured', 'rating')


@admin.register(ContactInfo)
class ContactInfoAdmin(admin.ModelAdmin):
    list_display = ('email', 'phone_number', 'city', 'country')
    # Limit to one instance
    def has_add_permission(self, request):
        return not ContactInfo.objects.exists()
    def has_delete_permission(self, request, obj=None):
        # Allow deletion if it's the only object, or if there are specific cases for allowing it
        return ContactInfo.objects.count() > 1 or False # Or simply 'False' to always disallow


@admin.register(SocialLink)
class SocialLinkAdmin(admin.ModelAdmin):
    list_display = ('platform', 'name', 'url', 'icon', 'order', 'active')
    list_filter = ('platform', 'active')
    list_editable = ('url', 'order', 'active', 'icon') # Allow editing of icon directly
    search_fields = ('name', 'url')


@admin.register(SiteSetting)
class SiteSettingAdmin(admin.ModelAdmin):
    list_display = ('site_title', 'maintenance_mode')
    fieldsets = (
        (None, {
            'fields': ('site_title', 'tagline', 'about_me', 'profile_picture', 'resume'),
        }),
        ('SEO & Analytics', {
            'fields': ('seo_description', 'seo_keywords', 'google_analytics_id'),
            'classes': ('collapse',),
            'description': "Configure site-wide SEO and analytics settings."
        }),
        ('Site Status', {
            'fields': ('maintenance_mode',),
            'description': "Enable to put your site in maintenance mode.",
        }),
    )
    # Limit to one instance
    def has_add_permission(self, request):
        return not SiteSetting.objects.exists()
    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'subject', 'created_at', 'is_read')
    list_filter = ('is_read',)
    search_fields = ('name', 'email', 'subject', 'message')
    readonly_fields = ('name', 'email', 'subject', 'message', 'created_at') # Messages are read-only
    actions = ['mark_as_read', 'mark_as_unread']

    def mark_as_read(self, request, queryset):
        queryset.update(is_read=True)
    mark_as_read.short_description = "Mark selected messages as read"

    def mark_as_unread(self, request, queryset):
        queryset.update(is_read=False)
    mark_as_unread.short_description = "Mark selected messages as unread"

