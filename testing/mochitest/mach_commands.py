# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from __future__ import unicode_literals

import logging
import mozpack.path
import os
import platform
import sys

from mozbuild.base import (
    MachCommandBase,
    MachCommandConditions as conditions,
    MozbuildObject,
)

from mach.decorators import (
    CommandArgument,
    CommandProvider,
    Command,
)

from mach.logging import StructuredHumanFormatter


class UnexpectedFilter(logging.Filter):
    def filter(self, record):
        msg = getattr(record, 'params', {}).get('msg', '')
        return 'TEST-UNEXPECTED-' in msg


class MochitestRunner(MozbuildObject):
    """Easily run mochitests.

    This currently contains just the basics for running mochitests. We may want
    to hook up result parsing, etc.
    """

    def __init__(self, *args, **kwargs):
        MozbuildObject.__init__(self, *args, **kwargs)

        # TODO Bug 794506 remove once mach integrates with virtualenv.
        build_path = os.path.join(self.topobjdir, 'build')
        if build_path not in sys.path:
            sys.path.append(build_path)

        self.tests_dir = os.path.join(self.topobjdir, '_tests')
        self.mochitest_dir = os.path.join(self.tests_dir, 'testing', 'mochitest')

    def run_b2g_test(self, b2g_home, xre_path, test_file=None, **kwargs):
        """Runs a b2g mochitest.

        test_file is a path to a test file. It can be a relative path from the
        top source directory, an absolute filename, or a directory containing
        test files.
        """
        # TODO without os.chdir, chained imports fail below
        os.chdir(self.mochitest_dir)

        import imp
        path = os.path.join(self.mochitest_dir, 'runtestsb2g.py')
        with open(path, 'r') as fh:
            imp.load_module('mochitest', fh, path,
                ('.py', 'r', imp.PY_SOURCE))

        import mochitest
        from mochitest_options import B2GOptions

        parser = B2GOptions()
        options = parser.parse_args([])[0]

        options.b2gPath = b2g_home
        options.consoleLevel = 'INFO'
        options.logcat_dir = self.mochitest_dir
        options.httpdPath = self.mochitest_dir
        options.xrePath = xre_path

        if test_file:
            options.testPath = test_file
        else:
            options.testManifest = 'b2g.json'

        for k, v in kwargs.iteritems():
            setattr(options, k, v)

        mochitest.run_remote_mochitests(parser, options)

    def run_desktop_test(self, suite=None, test_file=None, debugger=None,
        debugger_args=None, shuffle=False, keep_open=False, rerun_failures=False,
        no_autorun=False, repeat=0, run_until_failure=False, slow=False):
        """Runs a mochitest.

        test_file is a path to a test file. It can be a relative path from the
        top source directory, an absolute filename, or a directory containing
        test files.

        suite is the type of mochitest to run. It can be one of ('plain',
        'chrome', 'browser', 'metro', 'a11y').

        debugger is a program name or path to a binary (presumably a debugger)
        to run the test in. e.g. 'gdb'

        debugger_args are the arguments passed to the debugger.

        shuffle is whether test order should be shuffled (defaults to false).

        keep_open denotes whether to keep the browser open after tests
        complete.
        """
        if rerun_failures and test_file:
            print('Cannot specify both --rerun-failures and a test path.')
            return 1

        # Need to call relpath before os.chdir() below.
        test_path = ''
        if test_file:
            test_path = self._wrap_path_argument(test_file).relpath()

        failure_file_path = os.path.join(self.statedir, 'mochitest_failures.json')

        if rerun_failures and not os.path.exists(failure_file_path):
            print('No failure file present. Did you run mochitests before?')
            return 1

        from StringIO import StringIO
        from automation import Automation

        # runtests.py is ambiguous, so we load the file/module manually.
        if 'mochitest' not in sys.modules:
            import imp
            path = os.path.join(self.mochitest_dir, 'runtests.py')
            with open(path, 'r') as fh:
                imp.load_module('mochitest', fh, path,
                    ('.py', 'r', imp.PY_SOURCE))

        import mochitest

        # This is required to make other components happy. Sad, isn't it?
        os.chdir(self.topobjdir)

        automation = Automation()

        # Automation installs its own stream handler to stdout. Since we want
        # all logging to go through us, we just remove their handler.
        remove_handlers = [l for l in logging.getLogger().handlers
            if isinstance(l, logging.StreamHandler)]
        for handler in remove_handlers:
            logging.getLogger().removeHandler(handler)

        runner = mochitest.Mochitest(automation)

        opts = mochitest.MochitestOptions(automation)
        options, args = opts.parse_args([])

        appname = ''
        if sys.platform.startswith('darwin'):
            appname = os.path.join(self.distdir, self.substs['MOZ_MACBUNDLE_NAME'],
            'Contents', 'MacOS', 'webapprt-stub' + automation.BIN_SUFFIX)
        else:
            appname = os.path.join(self.distdir, 'bin', 'webapprt-stub' +
            automation.BIN_SUFFIX)

        # Need to set the suite options before verifyOptions below.
        if suite == 'plain':
            # Don't need additional options for plain.
            pass
        elif suite == 'chrome':
            options.chrome = True
        elif suite == 'browser':
            options.browserChrome = True
        elif suite == 'metro':
            options.immersiveMode = True
            options.browserChrome = True
        elif suite == 'a11y':
            options.a11y = True
        elif suite == 'webapprt-content':
            options.webapprtContent = True
            options.app = appname
        elif suite == 'webapprt-chrome':
            options.webapprtChrome = True
            options.app = appname
            options.browserArgs.append("-test-mode")
        else:
            raise Exception('None or unrecognized mochitest suite type.')

        options.autorun = not no_autorun
        options.closeWhenDone = not keep_open
        options.shuffle = shuffle
        options.consoleLevel = 'INFO'
        options.repeat = repeat
        options.runUntilFailure = run_until_failure
        options.runSlower = slow
        options.testingModulesDir = os.path.join(self.tests_dir, 'modules')
        options.extraProfileFiles.append(os.path.join(self.distdir, 'plugins'))
        options.symbolsPath = os.path.join(self.distdir, 'crashreporter-symbols')

        options.failureFile = failure_file_path

        if test_path:
            test_root = runner.getTestRoot(options)
            test_root_file = mozpack.path.join(self.mochitest_dir, test_root, test_path)
            if not os.path.exists(test_root_file):
                print('Specified test path does not exist: %s' % test_root_file)
                print('You may need to run |mach build| to build the test files.')
                return 1

            options.testPath = test_path

        if rerun_failures:
            options.testManifest = failure_file_path

        if debugger:
            options.debugger = debugger

        if debugger_args:
            if options.debugger == None:
                print("--debugger-args passed, but no debugger specified.")
                return 1
            options.debuggerArgs = debugger_args

        options = opts.verifyOptions(options, runner)

        if options is None:
            raise Exception('mochitest option validator failed.')

        automation.setServerInfo(options.webServer, options.httpPort,
            options.sslPort, options.webSocketPort)


        # We need this to enable colorization of output.
        self.log_manager.enable_unstructured()

        # Output processing is a little funky here. The old make targets
        # grepped the log output from TEST-UNEXPECTED-* and printed these lines
        # after test execution. Ideally the test runner would expose a Python
        # API for obtaining test results and we could just format failures
        # appropriately. Unfortunately, it doesn't yet do that. So, we capture
        # all output to a buffer then "grep" the buffer after test execution.
        # Bug 858197 tracks a Python API that would facilitate this.
        test_output = StringIO()
        handler = logging.StreamHandler(test_output)
        handler.addFilter(UnexpectedFilter())
        handler.setFormatter(StructuredHumanFormatter(0, write_times=False))
        logging.getLogger().addHandler(handler)

        result = runner.runTests(options)

        # Need to remove our buffering handler before we echo failures or else
        # it will catch them again!
        logging.getLogger().removeHandler(handler)
        self.log_manager.disable_unstructured()

        if test_output.getvalue():
            result = 1
            for line in test_output.getvalue().splitlines():
                self.log(logging.INFO, 'unexpected', {'msg': line}, '{msg}')

        return result


def MochitestCommand(func):
    """Decorator that adds shared command arguments to mochitest commands."""

    # This employs light Python magic. Keep in mind a decorator is just a
    # function that takes a function, does something with it, then returns a
    # (modified) function. Here, we chain decorators onto the passed in
    # function.

    debugger = CommandArgument('--debugger', '-d', metavar='DEBUGGER',
        help='Debugger binary to run test in. Program name or path.')
    func = debugger(func)

    debugger_args = CommandArgument('--debugger-args',
        metavar='DEBUGGER_ARGS', help='Arguments to pass to the debugger.')
    func = debugger_args(func)

    shuffle = CommandArgument('--shuffle', action='store_true',
        help='Shuffle execution order.')
    func = shuffle(func)

    keep_open = CommandArgument('--keep-open', action='store_true',
        help='Keep the browser open after tests complete.')
    func = keep_open(func)

    rerun = CommandArgument('--rerun-failures', action='store_true',
        help='Run only the tests that failed during the last test run.')
    func = rerun(func)

    autorun = CommandArgument('--no-autorun', action='store_true',
        help='Do not starting running tests automatically.')
    func = autorun(func)

    repeat = CommandArgument('--repeat', type=int, default=0,
        help='Repeat the test the given number of times.')
    func = repeat(func)

    runUntilFailure = CommandArgument("--run-until-failure", action='store_true',
        help='Run a test repeatedly and stops on the first time the test fails. ' \
             'Only available when running a single test. Default cap is 30 runs, ' \
             'which can be overwritten with the --repeat parameter.')
    func = runUntilFailure(func)

    slow = CommandArgument('--slow', action='store_true',
        help='Delay execution between tests.')
    func = slow(func)

    path = CommandArgument('test_file', default=None, nargs='?',
        metavar='TEST',
        help='Test to run. Can be specified as a single file, a ' \
            'directory, or omitted. If omitted, the entire test suite is ' \
            'executed.')
    func = path(func)

    return func

def B2GCommand(func):
    """Decorator that adds shared command arguments to b2g mochitest commands."""

    busybox = CommandArgument('--busybox', default=None,
        help='Path to busybox binary to install on device')
    func = busybox(func)

    logcatdir = CommandArgument('--logcat-dir', default=None,
        help='directory to store logcat dump files')
    func = logcatdir(func)

    profile = CommandArgument('--profile', default=None,
        help='for desktop testing, the path to the \
              gaia profile to use')
    func = profile(func)

    geckopath = CommandArgument('--gecko-path', default=None,
        help='the path to a gecko distribution that should \
              be installed on the emulator prior to test')
    func = geckopath(func)

    nowindow = CommandArgument('--no-window', action='store_true', default=False,
        help='Pass --no-window to the emulator')
    func = nowindow(func)

    sdcard = CommandArgument('--sdcard', default="10MB",
        help='Define size of sdcard: 1MB, 50MB...etc')
    func = sdcard(func)

    emulator = CommandArgument('--emulator', default='arm',
        help='Architecture of emulator to use: x86 or arm')
    func = emulator(func)

    marionette = CommandArgument('--marionette', default=None,
        help='host:port to use when connecting to Marionette')
    func = marionette(func)

    path = CommandArgument('test_file', default=None, nargs='?',
        metavar='TEST',
        help='Test to run. Can be specified as a single file, a ' \
            'directory, or omitted. If omitted, the entire test suite is ' \
            'executed.')
    func = path(func)

    return func


@CommandProvider
class MachCommands(MachCommandBase):
    @Command('mochitest-plain', category='testing',
        description='Run a plain mochitest.')
    @MochitestCommand
    def run_mochitest_plain(self, test_file, **kwargs):
        return self.run_mochitest(test_file, 'plain', **kwargs)

    @Command('mochitest-chrome', category='testing',
        description='Run a chrome mochitest.')
    @MochitestCommand
    def run_mochitest_chrome(self, test_file, **kwargs):
        return self.run_mochitest(test_file, 'chrome', **kwargs)

    @Command('mochitest-browser', category='testing',
        description='Run a mochitest with browser chrome.')
    @MochitestCommand
    def run_mochitest_browser(self, test_file, **kwargs):
        return self.run_mochitest(test_file, 'browser', **kwargs)

    @Command('mochitest-metro', category='testing',
        description='Run a mochitest with metro browser chrome.')
    @MochitestCommand
    def run_mochitest_metro(self, test_file, **kwargs):
        return self.run_mochitest(test_file, 'metro', **kwargs)

    @Command('mochitest-a11y', category='testing',
        description='Run an a11y mochitest.')
    @MochitestCommand
    def run_mochitest_a11y(self, test_file, **kwargs):
        return self.run_mochitest(test_file, 'a11y', **kwargs)

    @Command('webapprt-test-chrome', category='testing',
        description='Run a webapprt chrome mochitest.')
    @MochitestCommand
    def run_mochitest_webapprt_chrome(self, test_file, **kwargs):
        return self.run_mochitest(test_file, 'webapprt-chrome', **kwargs)

    @Command('webapprt-test-content', category='testing',
        description='Run a webapprt content mochitest.')
    @MochitestCommand
    def run_mochitest_webapprt_content(self, test_file, **kwargs):
        return self.run_mochitest(test_file, 'webapprt-content', **kwargs)

    def run_mochitest(self, test_file, flavor, **kwargs):
        self._ensure_state_subdir_exists('.')

        mochitest = self._spawn(MochitestRunner)
        return mochitest.run_desktop_test(test_file=test_file, suite=flavor,
            **kwargs)


# TODO For now b2g commands will only work with the emulator,
# they should be modified to work with all devices.
def is_emulator(cls):
    """Emulator needs to be configured."""
    return cls.device_name in ('emulator', 'emulator-jb')


@CommandProvider
class B2GCommands(MachCommandBase):
    def __init__(self, context):
        MachCommandBase.__init__(self, context)

        for attr in ('b2g_home', 'xre_path', 'device_name'):
            setattr(self, attr, getattr(context, attr, None))

    @Command('mochitest-remote', category='testing',
        description='Run a remote mochitest.',
        conditions=[conditions.is_b2g, is_emulator])
    @B2GCommand
    def run_mochitest_remote(self, test_file, **kwargs):
        self._ensure_state_subdir_exists('.')

        mochitest = self._spawn(MochitestRunner)
        return mochitest.run_b2g_test(self.b2g_home, self.xre_path,
            test_file=test_file, **kwargs)
