from django import template

register = template.Library()

@register.filter
def splitlines(value):
    if value:
        return [line.strip() for line in value.strip().splitlines() if line.strip()]
    return []