// @flow
import UserInput from '.'
import ServiceFilter from '../services-filter'
import React from 'react'
import {connect} from 'react-redux'
import {List} from 'immutable'
import * as Constants from '../../constants/search'
import * as Creators from '../../actions/search/creators'
import {createShallowEqualSelector} from '../../constants/selectors'
import {createSelector} from 'reselect'
import {parseUserId, serviceIdToIcon} from '../../util/platforms'
import {withState, withHandlers, compose, lifecycle} from 'recompose'
import * as HocHelpers from '../helpers'
import {Box} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'

import type {TypedState} from '../../constants/reducer'

type OwnProps = {
  searchKey: string,
  autoFocus: boolean,
  focusInputCounter: number,
  placeholder: ?string,
  onExitSearch: ?() => void,
}

const UserInputWithServiceFilter = props => {
  console.log('rendering')
  return (
    <Box style={{...globalStyles.flexBoxColumn, marginLeft: globalMargins.medium}}>
      <UserInput
        ref={props.setInputRef}
        autoFocus={props.autoFocus}
        userItems={props.userItems}
        onRemoveUser={props.onRemoveUser}
        onClickAddButton={props.onClickAddButton}
        placeholder={props.placeholder}
        usernameText={props.searchText}
        onChangeText={props.onChangeText}
        onMoveSelectUp={props.onMoveSelectUp}
        onMoveSelectDown={props.onMoveSelectDown}
        onClearSearch={props.onClearSearch}
        onAddSelectedUser={props.onAddSelectedUser}
        onEnterEmptyText={props.onExitSearch}
        onCancel={props.onExitSearch}
      />
      <Box style={{alignSelf: 'center'}}>
        {props.showServiceFilter &&
          <ServiceFilter selectedService={props.selectedService} onSelectService={props.onSelectService} />}
      </Box>
    </Box>
  )
}

const getSearchResultTerm = ({entities}: TypedState, {searchKey}: {searchKey: string}) => {
  const searchResultQuery = entities.getIn(['searchKeyToSearchResultQuery', searchKey], null)
  return searchResultQuery && searchResultQuery.text
}

const getFollowingStates = (state, ownProps) => {
  const itemIds = Constants.getUserInputItemIds(state, ownProps)
  const followingStateMap = {}
  itemIds.forEach(id => {
    const {username, serviceId} = parseUserId(id)
    const service = Constants.serviceIdToService(serviceId)
    followingStateMap[id] = Constants.followStateHelper(state, username, service)
  })
  return followingStateMap
}

const getUserItems = createShallowEqualSelector(
  [Constants.getUserInputItemIds, getFollowingStates],
  (ids, followingStates) =>
    ids.map(id => {
      const {username, serviceId} = parseUserId(id)
      const service = Constants.serviceIdToService(serviceId)
      return {
        id: id,
        followingState: followingStates[id],
        icon: serviceIdToIcon(serviceId),
        username,
        service,
      }
    })
)

// todo use selectors
const mapStateToProps = (state: TypedState, {searchKey}: OwnProps) => {
  const {entities} = state
  const searchResultTerm = getSearchResultTerm(state, {searchKey})
  const searchResultIds = Constants.getSearchResultIdsArray(state, {searchKey})
  const selectedSearchId = entities.getIn(['searchKeyToSelectedId', searchKey])
  const userItems = getUserItems(state, {searchKey})
  const clearSearchInput = Constants.getClearSearchInput(state, {searchKey})
  console.log('clear search', clearSearchInput)
  return {
    clearSearchInput,
    searchResultIds,
    selectedSearchId,
    userItems,
    searchResultTerm,
  }
}

// TODO
const mapDispatchToProps = (dispatch: Dispatch, {searchKey}) => ({
  onRemoveUser: id => dispatch(Creators.removeResultsToUserInput(searchKey, [id])),
  search: (term: string, service) => {
    if (term) {
      dispatch(Creators.search(term, 'todo:remove', 'todo:remove', searchKey, service))
    } else {
      dispatch(Creators.searchSuggestions(searchKey))
    }
  },
  onAddUser: id => dispatch(Creators.addResultsToUserInput(searchKey, [id])),
  clearSearchResults: () => dispatch(Creators.clearSearchResults(searchKey)),
  onUpdateSelectedSearchResult: id => {
    dispatch(Creators.updateSelectedSearchResult(searchKey, id))
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('searchText', 'onChangeSearchText', ''),
  withState('selectedService', '_onSelectService', 'Keybase'),
  HocHelpers.onChangeSelectedSearchResultHoc,
  HocHelpers.clearSearchHoc,
  HocHelpers.showServiceLogicHoc,
  withHandlers(() => {
    let input
    return {
      setInputRef: () => el => {
        input = el
      },
      onFocusInput: () => () => {
        input && input.focus()
      },
      onSelectService: props => nextService => {
        props._onSelectService(nextService)
        props.clearSearchResults()
        props.search(props.searchText, nextService)
        input && input.focus()
      },
      onClickAddButton: props => () => {
        props.search('', props.selectedService)
      },
    }
  }),
  lifecycle({
    componentWillReceiveProps(nextProps) {
      if (this.props.focusInputCounter !== nextProps.focusInputCounter) {
        this.props.onFocusInput()
      }

      if (this.props.searchResultIds !== nextProps.searchResultIds) {
        nextProps.onUpdateSelectedSearchResult(
          (nextProps.searchResultIds && nextProps.searchResultIds[0]) || null
        )
      }

      if (this.props.clearSearchInput !== nextProps.clearSearchInput) {
        nextProps.onChangeSearchText('')
      }
    },
  })
)(UserInputWithServiceFilter)
