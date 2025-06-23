# portfolio/forms.py
from django import forms
from .models import Blog, Comment, Project, ProjectImage, Skill # Ensure all necessary models are imported
from django.contrib.auth import get_user_model # Import User model
from django.utils.text import slugify # For ProjectForm's clean_slug

User = get_user_model() # Get the active user model

class ContactForm(forms.Form):
    """
    Form for handling contact messages from the portfolio.
    Maps to the Message model indirectly (view handles creation).
    """
    name = forms.CharField(
        max_length=100,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Your Name'})
    )
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'Your Email'})
    )
    subject = forms.CharField(
        max_length=200,
        required=False,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Subject (Optional)'})
    )
    message = forms.CharField(
        widget=forms.Textarea(attrs={'class': 'form-control', 'placeholder': 'Your Message', 'rows': 5})
    )

    def __str__(self):
        # Using self.cleaned_data safely after is_valid() check
        return f"Contact Form submission from {self.cleaned_data.get('name') if self.is_valid() else 'N/A'}"
    
class CommentForm(forms.ModelForm):
    """
    ModelForm for handling comments and replies on blog posts.
    Directly maps to the Comment model.
    """
    content = forms.CharField(
        widget=forms.Textarea(attrs={'class': 'form-control', 'placeholder': 'Share your thoughts...', 'rows': 4}),
        label="" # Label is often hidden in modern UIs, handled by placeholder
    )

    class Meta:
        model = Comment
        # CRITICAL FIX: Changed 'post' to 'blog_post' to match Comment model's ForeignKey
        fields = ['content', 'name', 'email', 'blog_post', 'parent'] 
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Your Name'}),
            'email': forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'Your Email (Optional)'}),
            'blog_post': forms.HiddenInput(), # Corrected field name
            'parent': forms.HiddenInput(),
        }
        labels = {
            'name': '', # Labels for name/email are often left empty if placeholders are descriptive
            'email': '',
        }

    def __init__(self, *args, **kwargs):
        # Extract 'user' from kwargs before calling super()
        # This user object will be request.user from the view
        self.user = kwargs.pop('user', None) 
        super().__init__(*args, **kwargs)
        
        # All fields are initially NOT required at the form level.
        # The custom 'clean' method will add specific requirements.
        self.fields['name'].required = False
        self.fields['email'].required = False # Email is optional by default in the model
        self.fields['content'].required = True # Content is always required

        # Pre-fill and make readonly for authenticated users
        if self.user and self.user.is_authenticated:
            self.fields['name'].initial = self.user.get_full_name() or self.user.username
            self.fields['email'].initial = self.user.email
            # Make fields read-only in the HTML widget attrs
            self.fields['name'].widget.attrs['readonly'] = True
            self.fields['email'].widget.attrs['readonly'] = True
            # Update placeholders to reflect they are filled automatically
            self.fields['name'].widget.attrs['placeholder'] = 'Your Name (Auto-filled)'
            self.fields['email'].widget.attrs['placeholder'] = 'Your Email (Auto-filled)'
        else:
            # For anonymous users, prompt for name (required by clean method)
            self.fields['name'].widget.attrs['placeholder'] = 'Your Name *'
            self.fields['email'].widget.attrs['placeholder'] = 'Your Email (Optional)' # Still optional

    def clean(self):
        """
        Custom clean method for additional validation.
        Ensures name is provided for anonymous comments.
        """
        cleaned_data = super().clean()
        name = cleaned_data.get('name')
        content = cleaned_data.get('content')

        # Content field is explicitly required in the form definition, but this adds a redundant check.
        # It's good for robustness.
        if not content:
            self.add_error('content', "Comment content cannot be empty.")

        # If user is NOT authenticated, the 'name' field is required.
        # We use self.user (which is request.user) to determine authentication status.
        if not self.user or not self.user.is_authenticated:
            if not name: # If anonymous and name is empty
                self.add_error('name', "Name is required for anonymous comments.")
        
        return cleaned_data


class ProjectForm(forms.ModelForm):
    """
    ModelForm for creating and updating Project instances.
    Note: This form does not directly handle ProjectImage instances.
    ProjectImages should be managed separately (e.g., via Django Admin inline,
    or a separate formset if building a custom project submission interface).
    """
    # CRITICAL FIX: Renamed 'description' to 'overview_content' to match model
    overview_content = forms.CharField( 
        widget=forms.Textarea(attrs={'rows': 8, 'placeholder': 'A detailed description for the project overview section.'}),
        help_text="Detailed description displayed in the 'Project Overview' section (supports Markdown/HTML if using a rich text editor)."
    )
    # No longer including 'description' as a field, since it's a property.
    
    full_description = forms.CharField( # This field seems to be unused in models.py now?
        required=False,
        widget=forms.Textarea(attrs={'rows': 8, 'placeholder': 'An even more detailed description for a potential project modal.'}),
        help_text="More detailed description for a potential project modal or extended content (optional)."
    )
    key_features = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={'rows': 5, 'placeholder': 'List key features, one per line or separated by semicolons.'}),
        help_text="Key features of the project, displayed in the modal."
    )
    challenges_and_solutions = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={'rows': 6, 'placeholder': 'Describe challenges encountered and their solutions.'}),
        help_text="Challenges faced during development and how they were overcome."
    )
    
    # Technologies M2M field
    technologies = forms.ModelMultipleChoiceField(
        queryset=Skill.objects.all().order_by('name'),
        widget=forms.CheckboxSelectMultiple, # Or forms.SelectMultiple with attrs={'class': 'form-control'}
        required=False,
        help_text="Select technologies used in this project."
    )

    class Meta:
        model = Project
        fields = [
            'title', 'slug', 'short_description', 'overview_content', # Corrected field name
            'key_features', 'challenges_and_solutions', 'featured_image', 'thumbnail', # Corrected image field name
            'live_demo_link', 'github_link', 'documentation_url', # Added documentation_url
            'technologies', 'status', 'start_date', 'end_date', 'featured',
            'seo_description', 'seo_keywords' # Added SEO fields to the form
        ]
        widgets = {
            'title': forms.TextInput(attrs={'placeholder': 'Project Title', 'class': 'form-control'}),
            'slug': forms.TextInput(attrs={'placeholder': 'auto-generated if left blank', 'class': 'form-control'}),
            'live_demo_link': forms.URLInput(attrs={'placeholder': 'https://example.com', 'class': 'form-control'}),
            'github_link': forms.URLInput(attrs={'placeholder': 'https://github.com/your-repo', 'class': 'form-control'}),
            'documentation_url': forms.URLInput(attrs={'placeholder': 'https://docs.example.com', 'class': 'form-control'}), # Added widget for new field
            'start_date': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'end_date': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'status': forms.Select(attrs={'class': 'form-control'}),
            'short_description': forms.Textarea(attrs={'rows': 2, 'placeholder': 'A concise one-liner summary.', 'class': 'form-control'}),
            'seo_description': forms.Textarea(attrs={'rows': 3, 'placeholder': 'Meta description for SEO (max ~160 chars).', 'class': 'form-control'}),
            'seo_keywords': forms.TextInput(attrs={'placeholder': 'comma, separated, keywords', 'class': 'form-control'}),
        }
        # You can add help_texts or error_messages if needed

    def clean_slug(self):
        """
        Ensure slug is unique, even if auto-generated.
        """
        slug = self.cleaned_data.get('slug')
        title = self.cleaned_data.get('title')

        if not slug and title: # Only auto-generate if slug is empty and title exists
            slug = slugify(title)
        elif not slug and not title: # If both are empty, raise an error for title
            raise forms.ValidationError("Title is required to generate a slug.")
            
        # Check for uniqueness, excluding current instance for updates
        qs = Project.objects.filter(slug=slug)
        if self.instance and self.instance.pk: # If updating an existing object
            qs = qs.exclude(pk=self.instance.pk)
            
        if qs.exists():
            raise forms.ValidationError(f"A project with the slug '{slug}' already exists. Please choose a different title or slug.")
        
        return slug

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Apply form-control class to ImageField widgets (File Input)
        if 'featured_image' in self.fields:
            self.fields['featured_image'].widget.attrs.update({'class': 'form-control-file'})
        if 'thumbnail' in self.fields:
            self.fields['thumbnail'].widget.attrs.update({'class': 'form-control-file'})
        
        # Apply form-control to all other relevant fields where it might not be explicitly set
        for field_name, field in self.fields.items():
            if isinstance(field.widget, (forms.TextInput, forms.EmailInput, forms.URLInput, 
                                         forms.Textarea, forms.DateInput, forms.Select)):
                # Only add if it's not already set by Meta.widgets or a specific override
                if 'class' not in field.widget.attrs:
                    field.widget.attrs.update({'class': 'form-control'})
