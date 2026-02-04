# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# Integrates android tests with mach

import os

from mach.decorators import Command, CommandArgument


def classname_for_test(test, test_path):
    """Convert path of test file to gradle recognized test suite name"""
    # Example:
    # test      = mobile/android/android-components/components/feature/addons/src/test/java/mozilla/components/feature/addons/ui/PermissionsDialogFragmentTest.kt
    # test_path = src/test/java
    # returns   = mozilla.components.feature.addons.ui.PermissionsDialogFragmentTest
    return (
        os.path.normpath(test)
        .split(os.path.normpath(test_path))[-1]
        .removeprefix(os.path.sep)
        .replace(os.path.sep, ".")
        .removesuffix(".kt")
        .removesuffix(".java")
    )


def project_for_test(test, prefix):
    """Get android project that test belongs to"""
    # Example:
    # test      = mobile/android/android-components/components/feature/addons/src/test/java/mozilla/components/feature/addons/ui/PermissionsDialogFragmentTest.kt
    # prefix    = mobile/android
    # returns   = android-components
    return (
        os.path.normpath(test)
        .split(os.path.normpath(prefix))[-1]
        .removeprefix(os.path.sep)
        .split(os.path.sep)[0]
    )


def project_for_ac(test, prefix, test_path):
    """Get project name for android-component subprojects from path of test file"""
    # Example:
    # test      = mobile/android/android-components/components/feature/addons/src/test/java/mozilla/components/feature/addons/ui/PermissionsDialogFragmentTest.kt
    # prefix    = mobile/android/android-components/components
    # test_path = src/test/java
    # returns   = feature-addons
    return (
        os.path.normpath(test)
        .split(os.path.normpath(prefix))[-1]
        .split(os.path.normpath(test_path))[0]
        .removeprefix(os.path.sep)
        .removesuffix(os.path.sep)
        .replace(os.path.sep, "-")
    )


@Command(
    "android-test",
    category="testing",
    description="Run Android tests.",
)
@CommandArgument(
    "--subproject",
    default="fenix",
    choices=["fenix", "focus", "android-components", "ac", "geckoview", "gv"],
    help="Android subproject to run tests for.",
)
@CommandArgument(
    "--test",
    default=None,
    help="File path of test to run.",
)
def run_android_test(command_context, subproject, test=None, test_objects=[], **kwargs):
    # Test paths may be a single command line, or a list from the test harness
    tests = [test["name"] for test in test_objects]
    if test:
        tests.append(test.strip())

    # Override subproject if test explicitly set
    if test:
        prefix = os.path.join("mobile", "android")
        subproject = project_for_test(test, prefix)

    # Resolve subproject aliases to match directory name as the canonical one
    ALIASES = {
        "focus": "focus-android",
        "ac": "android-components",
        "gv": "geckoview",
    }
    subproject = ALIASES.get(subproject, subproject)

    # This path fragment is used to split path between project and test class
    test_path = os.path.join("src", "test", "java")

    # Determine project directory
    if subproject == "fenix":
        subdir = os.path.join("mobile", "android", "fenix", "app")
    elif subproject == "focus-android":
        subdir = os.path.join("mobile", "android", "focus-android", "app")
    elif subproject == "android-components":
        subdir = os.path.join("mobile", "android", "android-components")
    elif subproject == "geckoview":
        subdir = os.path.join("mobile", "android", "geckoview")
    else:
        return None

    # Compute the gradle tasks we need
    if subproject == "fenix":
        gradle_command = ["testDebugUnitTest"]
    elif subproject == "focus-android":
        gradle_command = ["testFocusDebugUnitTest"]
    elif subproject == "android-components":
        if tests:
            # Identify the relevant a-c projects for the tests
            def project_name(test):
                prefix = os.path.join(subdir, "components")
                return project_for_ac(test, prefix, test_path)

            projects = dict.fromkeys(project_name(t) for t in tests)
            gradle_command = [f":components:{p}:testDebugUnitTest" for p in projects]
        else:
            gradle_command = ["testDebugUnitTest"]
    elif subproject == "geckoview":
        gradle_command = ["testDebugUnitTest"]
    else:
        return None

    # Compute the class names from file names
    gradle_command.append("--rerun")
    for t in tests:
        gradle_command.append("--tests")
        gradle_command.append(classname_for_test(t, test_path))

    return command_context._mach_context.commands.dispatch(
        "gradle",
        command_context._mach_context,
        args=["-q", "-p", subdir] + gradle_command,
    )
