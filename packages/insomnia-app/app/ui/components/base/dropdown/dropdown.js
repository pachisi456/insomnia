import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import DropdownButton from './dropdown-button';
import DropdownItem from './dropdown-item';
import DropdownDivider from './dropdown-divider';
import { fuzzyMatch } from '../../../../common/misc';
import KeydownBinder from '../../keydown-binder';
import { executeHotKey } from '../../../../common/hotkeys-listener';
import { hotKeyRefs } from '../../../../common/hotkeys';

const dropdownsContainer = document.querySelector('#dropdowns-container');

@autobind
class Dropdown extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      open: false,
      dropUp: false,

      // Filter Stuff
      filter: '',
      filterVisible: false,
      filterItems: null,
      filterActiveIndex: 0,

      // Use this to force new menu every time dropdown opens
      uniquenessKey: 0,
    };
  }

  _setRef(n) {
    this._node = n;
  }

  _handleCheckFilterSubmit(e) {
    if (e.key === 'Enter') {
      // Listen for the Enter key and "click" on the active list item
      const selector = `li[data-filter-index="${this.state.filterActiveIndex}"] button`;
      const button = this._dropdownList.querySelector(selector);
      button && button.click();
    }
  }

  _handleChangeFilter(e) {
    const newFilter = e.target.value;

    // Nothing to do if the filter didn't change
    if (newFilter === this.state.filter) {
      return;
    }

    // Filter the list items that are filterable (have data-filter-index property)
    const filterItems = [];
    for (const listItem of this._dropdownList.querySelectorAll('li')) {
      if (!listItem.hasAttribute('data-filter-index')) {
        continue;
      }

      const match = fuzzyMatch(newFilter, listItem.textContent);

      if (!newFilter || match) {
        const filterIndex = listItem.getAttribute('data-filter-index');
        filterItems.push(parseInt(filterIndex, 10));
      }
    }

    this.setState({
      filter: newFilter,
      filterItems: newFilter ? filterItems : null,
      filterActiveIndex: filterItems[0] || -1,
      filterVisible: this.state.filterVisible ? true : newFilter.length > 0,
    });
  }

  _handleDropdownNavigation(e) {
    const { key, shiftKey } = e;

    // Handle tab and arrows to move up and down dropdown entries
    const { filterItems, filterActiveIndex } = this.state;
    if (['Tab', 'ArrowDown', 'ArrowUp'].includes(key)) {
      e.preventDefault();
      let items = filterItems || [];
      if (!filterItems) {
        for (const li of this._dropdownList.querySelectorAll('li')) {
          if (li.hasAttribute('data-filter-index')) {
            const filterIndex = li.getAttribute('data-filter-index');
            items.push(parseInt(filterIndex, 10));
          }
        }
      }

      const i = items.indexOf(filterActiveIndex);
      if (key === 'ArrowUp' || (key === 'Tab' && shiftKey)) {
        const nextI = i > 0 ? items[i - 1] : items[items.length - 1];
        this.setState({ filterActiveIndex: nextI });
      } else {
        this.setState({ filterActiveIndex: items[i + 1] || items[0] });
      }
    }

    this._filter.focus();
  }

  _handleBodyKeyDown(e) {
    if (!this.state.open) {
      return;
    }

    // Catch all key presses (like global app hotkeys) if we're open
    e.stopPropagation();

    this._handleDropdownNavigation(e);

    executeHotKey(e, hotKeyRefs.CLOSE_DROPDOWN, () => {
      this.hide();
    });
  }

  _checkSizeAndPosition() {
    if (!this.state.open || !this._dropdownList) {
      return;
    }

    // Get dropdown menu
    const dropdownList = this._dropdownList;

    // Compute the size of all the menus
    const dropdownBtnRect = this._node.getBoundingClientRect();
    const bodyRect = document.body.getBoundingClientRect();
    const dropdownListRect = dropdownList.getBoundingClientRect();

    // Should it drop up?
    const bodyHeight = bodyRect.height;
    const dropdownTop = dropdownBtnRect.top;
    const dropUp = dropdownTop > bodyHeight - 200;

    // Reset all the things so we can start fresh
    this._dropdownList.style.left = 'initial';
    this._dropdownList.style.right = 'initial';
    this._dropdownList.style.top = 'initial';
    this._dropdownList.style.bottom = 'initial';
    this._dropdownList.style.minWidth = 'initial';
    this._dropdownList.style.maxWidth = 'initial';

    const screenMargin = 6;

    const { right, wide } = this.props;
    if (right || wide) {
      const { right: originalRight } = dropdownBtnRect;

      // Prevent dropdown from squishing against left side of screen
      const right = Math.max(dropdownListRect.width + screenMargin, originalRight);

      const { beside } = this.props;
      const offset = beside ? dropdownBtnRect.width - 40 : 0;
      this._dropdownList.style.right = `${bodyRect.width - right + offset}px`;
      this._dropdownList.style.maxWidth = `${Math.min(dropdownListRect.width, right + offset)}px`;
    }

    if (!right || wide) {
      const { left: originalLeft } = dropdownBtnRect;

      const { beside } = this.props;
      const offset = beside ? dropdownBtnRect.width - 40 : 0;

      // Prevent dropdown from squishing against right side of screen
      const left = Math.min(bodyRect.width - dropdownListRect.width - screenMargin, originalLeft);

      this._dropdownList.style.left = `${left + offset}px`;
      this._dropdownList.style.maxWidth = `${Math.min(
        dropdownListRect.width,
        bodyRect.width - left - offset,
      )}px`;
    }

    if (dropUp) {
      const { top } = dropdownBtnRect;
      this._dropdownList.style.bottom = `${bodyRect.height - top}px`;
      this._dropdownList.style.maxHeight = `${top - screenMargin}px`;
    } else {
      const { bottom } = dropdownBtnRect;
      this._dropdownList.style.top = `${bottom}px`;
      this._dropdownList.style.maxHeight = `${bodyRect.height - bottom - screenMargin}px`;
    }
  }

  _handleClick() {
    this.toggle();
  }

  static _handleMouseDown(e) {
    // Intercept mouse down so that clicks don't trigger things like drag and drop.
    e.preventDefault();
  }

  _addDropdownListRef(n) {
    this._dropdownList = n;
  }

  _addFilterRef(n) {
    this._filter = n;

    // Automatically focus the filter element when mounted so we can start typing
    if (this._filter) {
      this._filter.focus();
    }
  }

  _addDropdownMenuRef(n) {
    this._dropdownMenu = n;
  }

  _getFlattenedChildren(children) {
    let newChildren = [];

    // Ensure children is an array
    children = Array.isArray(children) ? children : [children];

    for (const child of children) {
      if (!child) {
        // Ignore null components
        continue;
      }

      if (child.type === React.Fragment) {
        newChildren = [...newChildren, ...this._getFlattenedChildren(child.props.children)];
      } else if (Array.isArray(child)) {
        newChildren = [...newChildren, ...this._getFlattenedChildren(child)];
      } else {
        newChildren.push(child);
      }
    }

    return newChildren;
  }

  componentDidUpdate() {
    this._checkSizeAndPosition();
  }

  hide() {
    // Focus the dropdown button after hiding
    if (this._node) {
      const button = this._node.querySelector('button');
      button && button.focus();
    }

    this.setState({ open: false });
    this.props.onHide && this.props.onHide();
  }

  show(filterVisible = false) {
    const bodyHeight = document.body.getBoundingClientRect().height;
    const dropdownTop = this._node.getBoundingClientRect().top;
    const dropUp = dropdownTop > bodyHeight - 200;

    this.setState({
      open: true,
      dropUp,
      filterVisible,
      filter: '',
      filterItems: null,
      filterActiveIndex: -1,
      uniquenessKey: this.state.uniquenessKey + 1,
    });

    this.props.onOpen && this.props.onOpen();
  }

  toggle(filterVisible = false) {
    if (this.state.open) {
      this.hide();
    } else {
      this.show(filterVisible);
    }
  }

  render() {
    const { right, outline, wide, className, style, children } = this.props;

    const {
      dropUp,
      open,
      uniquenessKey,
      filterVisible,
      filterActiveIndex,
      filterItems,
      filter,
    } = this.state;

    const classes = classnames('dropdown', className, {
      'dropdown--wide': wide,
      'dropdown--open': open,
    });

    const menuClasses = classnames({
      dropdown__menu: true,
      'theme--dropdown__menu': true,
      'dropdown__menu--open': open,
      'dropdown__menu--outlined': outline,
      'dropdown__menu--up': dropUp,
      'dropdown__menu--right': right,
    });

    const dropdownButtons = [];
    const dropdownItems = [];

    const allChildren = this._getFlattenedChildren(children);

    const visibleChildren = allChildren.filter((child, i) => {
      if (child.type.name !== DropdownItem.name) {
        return true;
      }

      // It's visible if its index is in the filterItems
      return !filterItems || filterItems.includes(i);
    });

    for (let i = 0; i < allChildren.length; i++) {
      const child = allChildren[i];
      if (child.type.name === DropdownButton.name) {
        dropdownButtons.push(child);
      } else if (child.type.name === DropdownItem.name) {
        const active = i === filterActiveIndex;
        const hide = !visibleChildren.includes(child);
        dropdownItems.push(
          <li key={i} data-filter-index={i} className={classnames({ active, hide })}>
            {child}
          </li>,
        );
      } else if (child.type.name === DropdownDivider.name) {
        const currentIndex = visibleChildren.indexOf(child);
        const nextChild = visibleChildren[currentIndex + 1];

        // Only show the divider if the next child is a DropdownItem
        if (nextChild && nextChild.type.name === DropdownItem.name) {
          dropdownItems.push(<li key={i}>{child}</li>);
        }
      }
    }

    let finalChildren = [];
    if (dropdownButtons.length !== 1) {
      console.error(`Dropdown needs exactly one DropdownButton! Got ${dropdownButtons.length}`, {
        allChildren,
      });
    } else {
      const noResults = filter && filterItems && filterItems.length === 0;
      finalChildren = [
        dropdownButtons[0],
        ReactDOM.createPortal(
          <div
            key="item"
            className={menuClasses}
            ref={this._addDropdownMenuRef}
            aria-hidden={!open}>
            <div className="dropdown__backdrop theme--transparent-overlay" />
            <div
              key={uniquenessKey}
              ref={this._addDropdownListRef}
              tabIndex="-1"
              className={classnames('dropdown__list', {
                'dropdown__list--filtering': filterVisible,
              })}>
              <div className="form-control dropdown__filter">
                <i className="fa fa-search" />
                <input
                  type="text"
                  onInput={this._handleChangeFilter}
                  ref={this._addFilterRef}
                  onKeyPress={this._handleCheckFilterSubmit}
                />
              </div>
              {noResults && <div className="text-center pad warning">No match :(</div>}
              <ul className={classnames({ hide: noResults })}>{dropdownItems}</ul>
            </div>
          </div>,
          dropdownsContainer,
        ),
      ];
    }

    return (
      <KeydownBinder stopMetaPropagation onKeydown={this._handleBodyKeyDown} disabled={!open}>
        <div
          style={style}
          className={classes}
          ref={this._setRef}
          onClick={this._handleClick}
          tabIndex="-1"
          onMouseDown={Dropdown._handleMouseDown}>
          {finalChildren}
        </div>
      </KeydownBinder>
    );
  }
}

Dropdown.propTypes = {
  // Required
  children: PropTypes.node.isRequired,

  // Optional
  right: PropTypes.bool,
  outline: PropTypes.bool,
  wide: PropTypes.bool,
  onOpen: PropTypes.func,
  onHide: PropTypes.func,
  className: PropTypes.string,
  style: PropTypes.string,
  beside: PropTypes.bool,
};

export default Dropdown;
