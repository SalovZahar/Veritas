from sources import find_sources
from inference import classify_text
from deep_analysis import deep_analyse

promt = "Internet restrictions, arms control: daily briefing from Kremlin. Dmitry Peskov said that Russia is currently forced to impose digital restrictions for security reasons"


classify = classify_text(promt)
sources = find_sources(promt)
print(classify)
print()
print(sources)
print()
print(deep_analyse(promt, classify, sources))