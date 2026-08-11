"""
Windows compatibility shim for gltest's direct-test harness.

gltest.direct.loader._inject_message_to_fd0 creates a temp file, dup2's it
onto fd 0, then calls os.unlink() while a duplicated handle is still open.
POSIX allows deleting an open file; Windows does not, so os.unlink raises
PermissionError there. This is a bug in the vendored test harness, not in
the contract under test -- swallow just that failure mode so direct tests
can run on Windows.
"""

import os

_orig_unlink = os.unlink


def _tolerant_unlink(path, *args, **kwargs):
    try:
        _orig_unlink(path, *args, **kwargs)
    except PermissionError:
        pass


os.unlink = _tolerant_unlink
