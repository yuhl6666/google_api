# Empty on purpose: its only job is to mark the repo root so pytest adds
# it to sys.path, making `import app...` work regardless of how pytest is
# invoked (plain `pytest`, `python -m pytest`, from a subdirectory, etc.).
