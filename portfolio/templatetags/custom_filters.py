from django import template
import re # Import the regular expression module for wordcount

register = template.Library()

@register.filter(name='wordcount')
def wordcount(value):
    """
    Counts the number of words in a string.
    Removes HTML tags before counting to provide a more accurate word count
    for rich text content (like blog post content).
    """
    if not isinstance(value, str):
        return 0
    # Remove HTML tags using a regular expression
    clean_text = re.sub(r'<[^>]+>', '', value)
    # Split by whitespace and count non-empty words
    words = clean_text.split()
    return len(words)

@register.filter(name='divide')
def divide(value, arg):
    """
    Divides the value by the argument.
    Handles potential ValueError (if input is not a number)
    and ZeroDivisionError (if argument is 0).
    Returns 0 in case of error, or None if you prefer. Returning 0 is safer for templates.
    """
    try:
        # Convert both value and arg to integers for division
        return int(value) / int(arg)
    except (ValueError, ZeroDivisionError):
        return 0 # Return 0 if division is not possible or arg is zero

@register.filter(name='floor')
def floor(value):
    """
    Returns the floor (integer part) of a number.
    Useful for rounding down calculated reading times to a whole number.
    """
    try:
        return int(value)
    except (ValueError, TypeError):
        return value # Return original value if conversion fails (e.g., non-numeric)

