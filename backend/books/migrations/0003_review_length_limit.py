# A ceiling and a help_text on MonthlyReading.review, both form-level: max_length on a TextField
# is validated by forms, not by the column, so this changes no data and no SQL type. It exists so
# the Admin's textarea (ADR-14 — the Admin is a shipped product) enforces the same 4000 characters
# MonthlyReadingIn enforces for the SPA, which is the surface that started offering the field.
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("books", "0002_rating_in_half_stars"),
    ]

    operations = [
        migrations.AlterField(
            model_name="monthlyreading",
            name="review",
            field=models.TextField(
                blank=True,
                help_text="O que a pessoa achou do livro. Todo o clubi lê.",
                max_length=4000,
            ),
        ),
    ]
