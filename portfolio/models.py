# portfolio/models.py
from django.db import models
from django.utils.text import slugify
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator
from django.contrib.auth import get_user_model # Import User model
from django.templatetags.static import static

User = get_user_model() # Get the currently active user model

class Skill(models.Model):
    # ... (Your existing Skill model code) ...
    CATEGORY_CHOICES = [
        ('frontend', 'Frontend'),
        ('backend', 'Backend'),
        ('database', 'Database'),
        ('devops', 'DevOps'),
        ('design', 'Design'),
        ('other', 'Other'),
    ]
    
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other')
    proficiency = models.PositiveIntegerField(
        default=50,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Proficiency level from 0 to 100"
    )
    icon = models.CharField(max_length=50, blank=True, null=True, help_text="Font Awesome icon class")
    order = models.PositiveIntegerField(default=0)
    featured = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['order', 'name']
    
    def __str__(self):
        return self.name

class Project(models.Model):
    # ... (Your existing Project model code, including new fields like full_description, etc.) ...
    STATUS_CHOICES = [
        ('completed', 'Completed'),
        ('in-progress', 'In Progress'),
        ('planned', 'Planned'),
    ]
    
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True, blank=True)
    description = models.TextField(help_text="Short description for project card and overview.")
    full_description = models.TextField(blank=True, null=True, help_text="Detailed description for the project modal.")
    key_features = models.TextField(blank=True, null=True, help_text="List key features, one per line or use Markdown.")
    challenges_and_solutions = models.TextField(blank=True, null=True, help_text="Describe challenges encountered and their solutions.")
    image = models.ImageField(upload_to='projects/', blank=True, null=True, help_text="Main image for project card/thumbnail.")
    thumbnail = models.ImageField(upload_to='projects/thumbnails/', blank=True, null=True, help_text="Optional, smaller thumbnail image.")
    live_demo_link = models.URLField(blank=True, null=True)
    github_link = models.URLField(blank=True, null=True)
    technologies = models.ManyToManyField(Skill, related_name='projects')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='completed')
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    featured = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-featured', '-end_date', '-created_at']
    
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)

    @property
    def get_main_category(self):
        tech_categories = set(self.technologies.values_list('category', flat=True))
        if 'frontend' in tech_categories and 'backend' in tech_categories:
            return 'fullstack'
        elif 'frontend' in tech_categories:
            return 'frontend'
        elif 'backend' in tech_categories:
            return 'backend'
        elif 'mobile' in tech_categories:
            return 'mobile'
        return 'other'

class ProjectImage(models.Model):
    # ... (Your existing ProjectImage model code) ...
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='gallery_images')
    image = models.ImageField(upload_to='projects/gallery_images/')
    caption = models.CharField(max_length=255, blank=True, null=True)
    order = models.PositiveIntegerField(default=0, help_text="Order in which images appear in the gallery.")

    class Meta:
        ordering = ['order', 'id']
        unique_together = ('project', 'order')

    def __str__(self):
        return f"Image {self.order} for {self.project.title}"


class Blog(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
    ]
    
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    content = models.TextField()
    excerpt = models.TextField(blank=True, null=True, max_length=500)
    featured_image = models.ImageField(upload_to='media/blog/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(blank=True, null=True)
    tags = models.ManyToManyField('Tag', related_name='blogs', blank=True)
    views = models.PositiveIntegerField(default=0)
    
    # NEW: Many-to-Many field for users who liked the post
    liked_by = models.ManyToManyField(User, related_name='liked_posts', blank=True)

    class Meta:
        ordering = ['-published_at']
    
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        if self.status == 'published' and not self.published_at:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)

    # NEW: Property to get the count of likes easily
    @property
    def likes_count(self):
        return self.liked_by.count()


class Comment(models.Model):
    # ... (Your existing Comment model code, including get_author_name and get_avatar_url properties) ...
    from django.templatetags.static import static # Import static
    post = models.ForeignKey('Blog', on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=100, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    content = models.TextField()
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    created_at = models.DateTimeField(default=timezone.now)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Comment by {self.get_author_name} on {self.post.title}"

    @property
    def is_reply(self):
        return self.parent is not None

    @property
    def get_author_name(self):
        if self.author:
            return self.author.get_full_name() or self.author.username
        return self.name or "Anonymous"

    @property
    def get_avatar_url(self):
        if self.author:
            if hasattr(self.author, 'profile') and self.author.profile.avatar:
                return self.author.profile.avatar.url
            return static('images/default_user_avatar.jpg')
        else:
            return static('images/default_comment_avatar.jpg')


class Tag(models.Model):
    # ... (Your existing Tag model code) ...
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(max_length=50, unique=True, blank=True)
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

class Experience(models.Model):
    # ... (Your existing Experience model code) ...
    title = models.CharField(max_length=200)
    company = models.CharField(max_length=200)
    location = models.CharField(max_length=100, blank=True, null=True)
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    current = models.BooleanField(default=False)
    description = models.TextField()
    skills = models.ManyToManyField(Skill, related_name='experiences', blank=True)
    employment_type = models.CharField(
        max_length=20,
        choices=[
            ('full-time', 'Full-time'),
            ('part-time', 'Part-time'),
            ('contract', 'Contract'),
            ('internship', 'Internship'),
            ('freelance', 'Freelance'),
        ],
        default='full-time'
    )
    
    class Meta:
        ordering = ['-start_date']
    
    def __str__(self):
        return f"{self.title} at {self.company}"
    
    def save(self, *args, **kwargs):
        if self.current:
            self.end_date = None
        super().save(*args, **kwargs)

class Education(models.Model):
    # ... (Your existing Education model code) ...
    degree = models.CharField(max_length=200)
    institution = models.CharField(max_length=200)
    major = models.CharField(max_length=100, blank=True, null=True)
    start_date = models.DateField(blank=True, null=True)
    graduation_date = models.DateField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    gpa = models.DecimalField(max_digits=3, decimal_places=2, blank=True, null=True)
    currently_attending = models.BooleanField(default=False)
    logo = models.ImageField(upload_to='education/logos/', blank=True, null=True)
    
    class Meta:
        ordering = ['-graduation_date']
    
    def __str__(self):
        return f"{self.degree} from {self.institution}"

class Certification(models.Model):
    # ... (Your existing Certification model code) ...
    name = models.CharField(max_length=255)
    issuing_organization = models.CharField(max_length=200)
    credential_id = models.CharField(max_length=100, blank=True, null=True)
    issue_date = models.DateField(blank=True, null=True)
    expiry_date = models.DateField(blank=True, null=True)
    certificate_link = models.URLField(blank=True, null=True)
    credential_url = models.URLField(blank=True, null=True)
    skills = models.ManyToManyField(Skill, related_name='certifications', blank=True)
    image = models.ImageField(upload_to='certifications/', blank=True, null=True)
    
    class Meta:
        ordering = ['-issue_date']
    
    def __str__(self):
        return self.name
    
    @property
    def is_expired(self):
        if self.expiry_date:
            return self.expiry_date < timezone.now().date()
        return False

class Award(models.Model):
    # ... (Your existing Award model code) ...
    name = models.CharField(max_length=255)
    awarding_organization = models.CharField(max_length=200)
    date_received = models.DateField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    link = models.URLField(blank=True, null=True)
    featured = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-date_received']
    
    def __str__(self):
        return self.name

class Service(models.Model):
    # ... (Your existing Service model code) ...
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=150, unique=True, blank=True)
    description = models.TextField()
    icon = models.CharField(max_length=50, blank=True, null=True)
    featured = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ['order', 'name']
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

class Testimonial(models.Model):
    # ... (Your existing Testimonial model code) ...
    name = models.CharField(max_length=200)
    company = models.CharField(max_length=200, blank=True, null=True)
    role = models.CharField(max_length=200, blank=True, null=True)
    testimonial_text = models.TextField()
    date_given = models.DateField(blank=True, null=True)
    avatar = models.ImageField(upload_to='testimonials/', blank=True, null=True)
    featured = models.BooleanField(default=False)
    rating = models.PositiveIntegerField(
        default=5,
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    
    class Meta:
        ordering = ['-featured', '-date_given']
    
    def __str__(self):
        return f"Testimonial by {self.name}"

class ContactInfo(models.Model):
    # ... (Your existing ContactInfo model code) ...
    email = models.EmailField()
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    map_embed_code = models.TextField(blank=True, null=True)
    
    def __str__(self):
        return "Contact Information"
    
    def save(self, *args, **kwargs):
        if ContactInfo.objects.exists() and not self.pk:
            return
        super().save(*args, **kwargs)

class SocialLink(models.Model):
    # ... (Your existing SocialLink model code) ...
    PLATFORM_CHOICES = [
        ('github', 'GitHub'),
        ('linkedin', 'LinkedIn'),
        ('twitter', 'Twitter'),
        ('facebook', 'Facebook'),
        ('instagram', 'Instagram'),
        ('youtube', 'YouTube'),
        ('medium', 'Medium'),
        ('dev', 'Dev.to'),
        ('other', 'Other'),
    ]
    
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    name = models.CharField(max_length=100, blank=True, null=True)
    url = models.URLField()
    icon = models.CharField(max_length=50, blank=True, null=True)
    order = models.PositiveIntegerField(default=0)
    active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['order']
    
    def __str__(self):
        return self.get_platform_display()
    
    def save(self, *args, **kwargs):
        if not self.name:
            self.name = self.get_platform_display()
        if not self.icon:
            # Note: For 'Dev.to', Font Awesome might use 'dev' or 'dev-to'
            # You might need to adjust this if 'fab fa-dev' doesn't work for your version.
            self.icon = f"fab fa-{self.platform}" if self.platform != 'dev' else "fab fa-dev" # Specific for dev.to
        super().save(*args, **kwargs)

class SiteSetting(models.Model):
    # ... (Your existing SiteSetting model code) ...
    site_title = models.CharField(max_length=255, default="My Portfolio")
    tagline = models.CharField(max_length=255, blank=True, null=True)
    about_me = models.TextField(blank=True, null=True)
    profile_picture = models.ImageField(upload_to='profile/', blank=True, null=True)
    resume = models.FileField(upload_to='resume/', blank=True, null=True)
    seo_description = models.TextField(blank=True, null=True)
    seo_keywords = models.CharField(max_length=255, blank=True, null=True)
    google_analytics_id = models.CharField(max_length=50, blank=True, null=True)
    maintenance_mode = models.BooleanField(default=False)
    
    def __str__(self):
        return "Site Settings"
    
    def save(self, *args, **kwargs):
        if SiteSetting.objects.exists() and not self.pk:
            return
        super().save(*args, **kwargs)

class Message(models.Model):
    # ... (Your existing Message model code) ...
    name = models.CharField(max_length=100)
    email = models.EmailField()
    subject = models.CharField(max_length=200)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Message from {self.name}"
    


