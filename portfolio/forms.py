# forms.py
from django import forms
from .models import Blog, Comment, Project, ProjectImage, Skill
# IMPORTANT: Import User model here to use in clean method logic if needed
from django.contrib.auth import get_user_model

User = get_user_model() # Get the active user model

class ContactForm(forms.Form):
    """
    Form for handling contact messages from the portfolio.
    Maps to the Message model indirectly.
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
        label=""
    )

    class Meta:
        model = Comment
        fields = ['content', 'name', 'email', 'post', 'parent']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Your Name'}),
            'email': forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'Your Email (Optional)'}),
            'post': forms.HiddenInput(),
            'parent': forms.HiddenInput(),
        }
        labels = {
            'name': '',
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
        self.fields['email'].required = False

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
        email = cleaned_data.get('email') # Email is optional per model

        # Content is a required field in the form, but let's add a backend check too
        content = cleaned_data.get('content')
        if not content:
            self.add_error('content', "Comment content cannot be empty.")

        # If user is NOT authenticated, the 'name' field is required.
        # We use self.user (which is request.user) to determine authentication status.
        if not self.user or not self.user.is_authenticated:
            if not name: # If anonymous and name is empty
                self.add_error('name', "Name is required for anonymous comments.")
        
        return cleaned_data


class ProjectForm(forms.ModelForm):
    # ... (rest of your ProjectForm and other forms remain the same) ...
    """
    ModelForm for creating and updating Project instances.
    Note: This form does not directly handle ProjectImage instances.
    ProjectImages should be managed separately (e.g., via Django Admin inline,
    or a separate formset if building a custom project submission interface).
    """
    # You can customize widgets, add labels, or make fields required/optional here
    description = forms.CharField(
        widget=forms.Textarea(attrs={'rows': 4, 'placeholder': 'A concise overview for the project card.'}),
        help_text="Short description displayed on the project card."
    )
    full_description = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={'rows': 8, 'placeholder': 'A detailed description for the project modal.'}),
        help_text="Detailed description for the project modal (supports Markdown/HTML if using a rich text editor)."
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
            'title', 'slug', 'description', 'full_description', 
            'key_features', 'challenges_and_solutions', 'image', 'thumbnail', 
            'live_demo_link', 'github_link', 'technologies', 'status', 
            'start_date', 'end_date', 'featured'
        ]
        widgets = {
            'title': forms.TextInput(attrs={'placeholder': 'Project Title'}),
            'slug': forms.TextInput(attrs={'placeholder': 'auto-generated if left blank'}),
            'live_demo_link': forms.URLInput(attrs={'placeholder': 'https://example.com'}),
            'github_link': forms.URLInput(attrs={'placeholder': 'https://github.com/your-repo'}),
            'start_date': forms.DateInput(attrs={'type': 'date'}),
            'end_date': forms.DateInput(attrs={'type': 'date'}),
            # For status, you might use RadioSelect if choices are few, or Select if many
            'status': forms.Select(attrs={'class': 'form-control'}),
        }
        # You can add help_texts or error_messages if needed

    def clean_slug(self):
        """
        Ensure slug is unique, even if auto-generated.
        """
        slug = self.cleaned_data.get('slug')
        if not slug:
            slug = slugify(self.cleaned_data.get('title'))
            
        # Check for uniqueness, excluding current instance for updates
        if Project.objects.filter(slug=slug).exclude(pk=self.instance.pk if self.instance else None).exists():
            raise forms.ValidationError(f"A project with the slug '{slug}' already exists. Please choose a different title or slug.")
        
        return slug

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Optional: Add Bootstrap/Tailwind classes to all fields
        for field_name, field in self.fields.items():
            if isinstance(field.widget, (forms.TextInput, forms.EmailInput, forms.URLInput, forms.Textarea, forms.DateInput, forms.Select)):
                field.widget.attrs.update({'class': 'form-control'})
            elif isinstance(field.widget, forms.ClearableFileInput):
                field.widget.attrs.update({'class': 'form-control-file'})
            # CheckboxSelectMultiple does not need 'form-control' class generally
